import mongoose from 'mongoose'

export default mongoose.model('User', {
    name: String,
    email: String,
    password: String,
    registeredAt: Date,
    avatar: String,
    fbId: String,
    avatar: {
        type: String,
        default: 'https://res.cloudinary.com/needu/image/upload/v1546382254/user-default.jpg'
    }
})