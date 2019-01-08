import cloudinary from 'cloudinary'

const normalize = result => {
    let newResult
    if (Array.isArray(result)) {
        newResult = []
        newResult = result.map(item => ({ ...item._source, id: item._id }))
    } else {
        newResult = { ...result._source, id: result._id }
    }
    return newResult
}

const cloudinaryUpload = file => {
    return new Promise((resolve, reject) => {
        cloudinary.v2.uploader.upload(file, (err, result) => {
            if (err) reject(err)
            resolve(result)
        })
    })
}

export { normalize, cloudinaryUpload }