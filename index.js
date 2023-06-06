const express=require('express')
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt=require('jsonwebtoken')


const port=process.env.PORT||5000;
const app=express()

// middleware
app.use(cors())
app.use(express.json())

const verifyToken=(req,res,next)=>{
  const authorization=req.headers.authorization
  if(!authorization){
    return res.status(401).send({error:true, message:'unauthorized access'})
  }
  const token=authorization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, (err,decoded)=>{
    if(err){
      return res.status(401).send({error:true, message:'token expired'})
    }
    req.decoded=decoded
    next()
  })
}



const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_KEY}@cluster0.df7drrh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
     
    
    // jwt related 
    app.post('/jwt',(req,res)=>{
      const user=req.body
      const token=jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'2h'})
      res.send({token})
    })




 // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);


app.get('/',(req,res)=>{
    res.send('assigment is running now')
})


app.listen(port)