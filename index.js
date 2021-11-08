const express = require('express')
const admin = require("firebase-admin");
const { initializeApp } = require('firebase-admin/app');
const app = express()
const port = process.env.PORT || 5000
const cors = require('cors')
require('dotenv').config()
const { MongoClient } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wanl6.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


// middleware
app.use(cors())
app.use(express.json())

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVER_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function verifyToken(req, res, next) {
    const idToken = req.headers?.authorization
    if (idToken?.startsWith('Bearer ')) {
        const token = idToken.split(' ')[1]

        try {
            const decodedUser = await admin.auth().verifyIdToken(token)
            req.decodedEmail = decodedUser.email

        } catch {

        }
    }
    next()
}

async function run() {
    try {
        await client.connect();
        const database = client.db("doctors_portal");
        const appointmentsCollection = database.collection("appointments");
        const usersCollection = database.collection("users");

        // GET
        app.get('/appointments', async (req, res) => {
            const email = req.query.email
            const date = req.query.date
            const filter = { email: email, date: date }
            const cursor = appointmentsCollection.find(filter);
            const result = await cursor.toArray()
            res.json(result)

        })

        app.post('/appointments', async (req, res) => {
            const body = req.body
            const result = await appointmentsCollection.insertOne(body)
            res.json(result)

        })

        app.post('/users', async (req, res) => {
            const body = req.body
            const result = await usersCollection.insertOne(body)
            res.json(result)
            console.log('hitted users post', result);
        })

        app.put('/users', async (req, res) => {
            const user = req.body
            const filter = { email: user.email }
            const options = { upsert: true }
            const updateUser = { $set: user }
            const result = await usersCollection.updateOne(filter, updateUser, options)
            res.json(result)
        })

        // MAkE ADMIN

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body
            const requester = req.decodedEmail;
            if (requester) {
                const requestAccount = await usersCollection.findOne({ email: requester })
                if (requestAccount.role === 'admin') {
                    const filter = { email: user.email }
                    const updateDoc = { $set: { "role": 'admin' } }
                    const result = await usersCollection.updateOne(filter, updateDoc)
                    res.json(result)
                }
            } else {
                res.status(403).json({ message: `You don't have any permission` })
            }


        })

        // 
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email

            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let isAdmin = false
            if (user?.role === 'admin') {
                isAdmin = true
            }
            res.json({ admin: isAdmin })
        })



    } finally {
        // await client.close();
    }

}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})