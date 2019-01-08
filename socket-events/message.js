import elasticClient from '../elasticClient'
import { normalize } from '../helpers'

export default data => {
    return new Promise(async (resolve, reject) => {
        try {
            const createMessage = conversation => {
                return new Promise(async (resolve, reject) => {
                    let response = await elasticClient.index({
                        index: 'messages',
                        type: 'message',
                        body: {
                            content: data.content,
                            sentAt: new Date(),
                            conversation: conversation,
                            sentBy: data.author
                        }
                    })
                    response = await elasticClient.get({
                        index: 'messages',
                        type: 'message',
                        id: response._id
                    })
                    resolve(normalize(response))
                })
            }
            let response = await elasticClient.search({
                index: 'conversations',
                type: 'conversation',
                body: {
                    query: {
                        bool: {
                            must: [
                                { multi_match: {
                                    query: data.author,
                                    fields: [ 'author', 'recipient' ]
                                } },
                                { multi_match: {
                                    query: data.recipient,
                                    fields: [ 'author', 'recipient' ]
                                } }
                            ]
                        }
                    }
                }
            })
            let conversation
            if (response.hits.hits.length) {
                conversation = normalize(response.hits.hits[0]).id
            } else {
                response = await elasticClient.index({
                    index: 'conversations',
                    type: 'conversation',
                    body: {
                        author: data.author,
                        recipient: data.recipient,
                        createdAt: new Date()
                    }
                })
                conversation = response._id
            }
            const message = await createMessage(conversation)
            resolve(message)
        } catch (err) {
            reject(err)
        }
    })
}