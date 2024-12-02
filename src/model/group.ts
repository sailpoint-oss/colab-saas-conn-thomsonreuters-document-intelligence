import { Attributes } from "@sailpoint/connector-sdk";

export class Group {
    identity: string
    uuid: string
    type: string = 'groups'
    attributes: Attributes

    constructor(object: any) {
        this.attributes = {
            id: object.id?.toString(),
            name: object.name,
            description: object.description
        }
        this.identity = this.attributes.id as string
        this.uuid = this.attributes.name as string
    }
}