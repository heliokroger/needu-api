import elasticClient from './elasticClient'

(async () => {
    try {
        await elasticClient.indices.create({
            index: 'people',
            body: {
                mappings: {
                    person: {
                        properties: {
                            name: { type: 'text' },
                            address: { type: 'text' },
                            geometry: { type: 'number' },
                            createdAt: { type: 'date' },
                            photos: { type: 'text' },
                            user: { type: 'text' },
                            geometry: { type: 'geo_point' }
                        }
                    }
                }
            }
        })
        await elasticClient.indices.create({
            index: 'conversations',
            body: {
                mappings: {
                    conversation: {
                        properties: {
                            author: { type: 'text' },
                            recipient: { type: 'text' },
                            createdAt: { type: 'date' }
                        }
                    }
                }
            }
        })
        await elasticClient.indices.create({
            index: 'messages',
            body: {
                mappings: {
                    message: {
                        properties: {
                            content: { type: 'text' },
                            sentAt: { type: 'date' },
                            conversation: { type: 'text' },
                            sentBy: { type: 'text' }
                        }
                    }
                }
            }
        })
    } catch (err) {
        throw err
    }
})()