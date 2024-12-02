import { Attributes, StdAccountReadOutput } from '@sailpoint/connector-sdk'
import { Group } from "./group"

export class Account {
    identity: string
    uuid: string
    attributes: Attributes
    disabled: boolean

    constructor(object: any) {
        this.attributes = {
            id: object.id?.toString(),
            status: object.status,
            name: object.name,
            email: object.email,
            role: object.role,
            groups: object.groups
        }
        this.identity = this.attributes.id?.toString() as string
        this.uuid = this.attributes.email as string
        this.disabled = !(object.status === "Active" || object.status === "Invited")
    }
}