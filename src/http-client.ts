import { ConnectorError, logger, StdTestConnectionOutput } from '@sailpoint/connector-sdk'
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

const MOCK_DATA = new Map([
    [
        'john.doe',
        {
            id: '1',
            username: 'john.doe',
            firstName: 'john',
            lastName: 'doe',
            email: 'john.doe@example.com',
        },
    ],
    [
        'jane.doe',
        {
            id: '2',
            username: 'jane.doe',
            firstName: 'jane',
            lastName: 'doe',
            email: 'jane.doe@example.com',
        },
    ],
])

export class HTTPClient {
    private clientId: string
    private clientSecret: string
    private accessToken?: string
    private baseUrl?: string

    constructor(config: any) {
        this.baseUrl = config.baseUrl
        this.clientId = config.clientId
        this.clientSecret = config.clientSecret

        if (config.ignoreSSL) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        }
    }

    getEndpoint(service: string): string {
        let endpoint: string = ''
        const baseUrl = this.baseUrl
        switch (service) {
            case 'user':
                endpoint = `${baseUrl}/api/users`
                break
            case 'group':
                endpoint = `${baseUrl}/api/securityGroups`
                break
        }
        return endpoint
    }

    async getAccessToken(): Promise<string | undefined> {
        const request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            data: `client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials`,
            url: '/connect/token',
        }
        const url = axios.getUri(request)

        const response: AxiosResponse = await axios(request)
        this.accessToken = response.data.access_token

        return this.accessToken
    }

    async getAccounts(): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.getEndpoint('user'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'List Accounts - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform List Accounts`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform List Accounts - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getAccount(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.getEndpoint('user'),
            url: `/${id}`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }
        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Account read successful',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to read account ${id}`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to read account ${id} - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getUserGroups(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.baseUrl,
            url: this.getEndpoint('group'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }
        logger.info(`Searching for groups that contain id ${id}`)
        return axios(request)
            .then((response) => {
                const filteredResponse = response.data.filter((record: any) => {
                    return record.users.includes(id)
                })
                logger.info({
                    message: 'User group retrieval successful',
                    statusCode: response.status,
                    response: response.data,
                })
                response.data = filteredResponse
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to retrieve user groups`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })
                throw new ConnectorError(
                    `Issue when trying to retrieve user groups - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async createAccount(user: object): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        let request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.getEndpoint('user'),
            headers: {
                Authorization: `Bearer accessToken`,
                Accept: 'application/json',
            },
            data: user,
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Account create successful',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to create account`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to create account - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async patchUser(id: string, body: object): Promise<AxiosResponse> {
        logger.info(`Patch user body is ${JSON.stringify(body)}`)
        const accessToken = await this.getAccessToken()
        let request: AxiosRequestConfig = {
            method: 'patch',
            baseURL: this.getEndpoint('user'),
            url: `/${id}`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/merge-patch+json',
            },
            data: body,
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'User update successful',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to update user`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to update user - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getGroups(): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.baseUrl,
            url: this.getEndpoint('group'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'List Groups - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform List Groups`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform List Groups - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getGroup(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.getEndpoint('group'),
            url: `/${id}`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Group retrieval successful',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to retrieve group`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to retrieve group - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async patchGroup(id: string, body: object): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        let request: AxiosRequestConfig = {
            method: 'patch',
            baseURL: this.getEndpoint('group'),
            url: `/${id}`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/merge-patch+json',
            },
            data: body,
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Group update successful',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to update group`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to update group - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async testConnection(): Promise<StdTestConnectionOutput> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.baseUrl,
            url: this.getEndpoint('users'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Test Connection Successful',
                    statusCode: response.status,
                    response: response.data,
                })
                return {}
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform Test Connection`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform Test Connection - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }
}
