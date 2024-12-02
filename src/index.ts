import {
    Context,
    ConnectorError,
    createConnector,
    readConfig,
    Response,
    StdAccountCreateInput,
    StdAccountCreateOutput,
    StdAccountListInput,
    StdAccountListOutput,
    StdAccountReadInput,
    StdAccountReadOutput,
    StdAccountUpdateInput,
    StdAccountUpdateOutput,
    StdEntitlementListOutput,
    StdEntitlementReadOutput,
    StdEntitlementReadInput,
    StdTestConnectionInput,
    StdTestConnectionOutput,
    AttributeChangeOp,
    StdAccountDisableInput,
    StdAccountDisableOutput,
    StdAccountEnableOutput,
    StdAccountEnableInput,
    AttributeChange,
    logger,
} from '@sailpoint/connector-sdk'
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { HTTPClient } from './http-client'
import { Account } from './model/account'
import { Group } from './model/group'

export const connector = async () => {
    const config = await readConfig()
    const httpClient = new HTTPClient(config)

    const readAccount = async (id: string): Promise<Account> => {
        const account_response: AxiosResponse = await httpClient.getAccount(id)
        const account: Account = new Account(account_response.data)

        const groups_response: AxiosResponse = await httpClient.getUserGroups(id)
        let groups = groups_response.data.map((x: { id: any }) => x.id.toString())
        if (account.attributes.role == 'Admin') {
            groups.push('Admin')
        }
        account.attributes.groups = groups

        return account
    }

    const updateAccount = async (account: Account, attribute: string, value: string | boolean) => {
        let user_update: { [key: string]: any } = {}
        user_update[attribute] = value

        const user_update_response: AxiosResponse = await httpClient.patchUser(account.identity, user_update)
    }

    const updateGroupUsers = async (account: Account, group: string, op: string) => {
        if (group != 'Admin') {
            const group_response = await httpClient.getGroup(group)
            let group_update: { [key: string]: any } = {}

            if (!group_response.data.users.includes(account.identity) && op == 'Add') {
                logger.info(`Adding ${account.attributes.name} to group ${group}`)
                ;(group_update.users = group_response.data.users), group_update.users.push(account.identity)
            }
            if (group_response.data.users.includes(account.identity) && op == 'Remove') {
                logger.info(`Removing ${account.attributes.name} from group ${group}`)
                group_update.users = group_response.data.users
                group_update.users = group_update.users?.filter((item: String) => item != account.identity)
            }

            const group_update_response: AxiosResponse = await httpClient.patchGroup(group, group_update)
        }
        if (group == 'Admin') {
            let user_update: { [key: string]: any } = {}
            if (op == 'Add') {
                user_update.role = 'Admin'
                const user_update_response: AxiosResponse = await httpClient.patchUser(account.identity, user_update)
            }
            if (op == 'Remove') {
                user_update.role = 'User'
                const user_update_response: AxiosResponse = await httpClient.patchUser(account.identity, user_update)
            }
        }
    }

    return createConnector()
        .stdTestConnection(
            async (context: Context, input: StdTestConnectionInput, res: Response<StdTestConnectionOutput>) => {
                logger.info('Running test connection')
                res.send(await httpClient.testConnection())
            }
        )
        .stdAccountList(async (context: Context, input: StdAccountListInput, res: Response<StdAccountListOutput>) => {
            logger.info('Reading accounts from Document Intelligence')
            const accounts: AxiosResponse = await httpClient.getAccounts()

            for (const acc of accounts.data) {
                const account: Account = await readAccount(acc.id)
                logger.info(account)
                res.send(account)
            }
        })
        .stdAccountRead(async (context: Context, input: StdAccountReadInput, res: Response<StdAccountReadOutput>) => {
            logger.info(`Reading account with Id - ${input.identity}`)
            const account = await readAccount(input.identity)
            res.send(account)
        })
        .stdAccountCreate(
            async (context: Context, input: StdAccountCreateInput, res: Response<StdAccountCreateOutput>) => {
                logger.info(`${input}`)

                //Checks to see if account already exists, in case it was created outside of ISC in between aggregations
                const accounts: AxiosResponse = await httpClient.getAccounts()
                const existingAccounts = accounts.data.find((account: any) => account.email === input.attributes.email)
                if (existingAccounts?.length ?? 0 > 0) {
                    logger.info(`A new account for ${input.attributes.full_name} will not be created because
                    an existing account was found`)

                    let account = await readAccount(existingAccounts[0].id)
                    if (input.attributes.groups?.length ?? 0 > 0) {
                        for (const group of input.attributes.groups) {
                            updateGroupUsers(account, group, 'Add')
                        }
                        account = await readAccount(account.identity)
                        res.send(account)
                    } else {
                        res.send(account)
                    }
                } else {
                    const user = { ...input.attributes }
                    delete user.groups
                    const account_response = await httpClient.createAccount(user)
                    let account = await readAccount(account_response.data.id)
                    logger.info(`New Account Created for ${input.attributes.name} - account id is ${account.identity}`)

                    //If groups are included in the create request, add the user to the group
                    if (input.attributes.groups?.length ?? 0 > 0) {
                        for (const group of input.attributes.groups) {
                            updateGroupUsers(account, group, 'Add')
                        }
                        account = await readAccount(account_response.data.id)
                        res.send(account)
                    } else {
                        res.send(account)
                    }
                }
            }
        )
        .stdAccountUpdate(
            async (context: Context, input: StdAccountUpdateInput, res: Response<StdAccountUpdateOutput>) => {
                for (let change of input.changes) {
                    const values = [].concat(change.value)
                    for (let value of values) {
                        const account = await readAccount(input.identity)
                        switch (change.op) {
                            case AttributeChangeOp.Add:
                                logger.info(
                                    `Sending provisioning request for ${account.attributes.name} to group id ${value}`
                                )
                                await updateGroupUsers(account, value, 'Add')
                                break
                            case AttributeChangeOp.Remove:
                                logger.info(
                                    `Sending deprovisioning request for ${account.attributes.name} from group id ${value}`
                                )
                                await updateGroupUsers(account, value, 'Remove')
                                break
                            case AttributeChangeOp.Set:
                                logger.info(
                                    `Sending attribute update request for ${account.attributes.name} - ${change.attribute}:${value}`
                                )
                                await updateAccount(account, change.attribute, value)
                                break
                            default:
                                throw new ConnectorError(`Operation not supported: ${change.op}`)
                        }
                    }
                }
                const account = await readAccount(input.identity)
                logger.info(account)
                res.send(account)
            }
        )
        .stdAccountEnable(async (context: Context, input: StdAccountEnableInput, res: Response<StdAccountEnableOutput>) => {
            const account = await readAccount(input.identity)
            logger.debug(`Sending account enable request for ${account.attributes.name}`)
            
            await updateAccount(account, 'isActive', true)
            
            res.send(await readAccount(input.identity))
        })
        .stdAccountDisable(async (context: Context, input: StdAccountDisableInput, res: Response<StdAccountDisableOutput>) => {
            const account = await readAccount(input.identity)
            logger.debug(`Sending account disable request for ${account.attributes.name}`)
            
            await updateAccount(account, 'isActive', false)
            
            res.send(await readAccount(input.identity))
        })
        .stdEntitlementList(async (context: Context, input: any, res: Response<StdEntitlementListOutput>) => {
            const group_response = await httpClient.getGroups()
            const trimmed_groups = group_response.data.map(
                ({ id, name, description }: { id: string; name: string; description: string }) => ({
                    id,
                    name,
                    description,
                })
            )
            for (const group of trimmed_groups) {
                const response: Group = new Group(group)
                res.send(response)
            }
            const adminGroup: Group = new Group({
                id: 'Admin',
                name: 'Admin',
                description: 'Grants Admin role to user',
            })
            res.send(adminGroup)
        })
}
