const express=require('express')
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt=require('jsonwebtoken')


const port=process.env.PORT||5000;
const app=express()

// middlewares
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
    // await client.connect();
    const userCollections=client.db('linguaAdventure').collection('users')
    const classCollections=client.db('linguaAdventure').collection('classes')
    const instructorCollections=client.db('linguaAdventure').collection('instructors')
    const sliderCollections=client.db('linguaAdventure').collection('sliders')
    const classCartCollections=client.db('linguaAdventure').collection('class-cart')
    const reviewCollections=client.db('linguaAdventure').collection('reviews')
    
    
     
    
    // jwt related 
    app.post('/jwt',(req,res)=>{
      const user=req.body
      const token=jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'2h'})
      res.send({token})
    })


    // sliders related 
    app.get('/sliders', async(req,res)=>{
      const result=await sliderCollections.find().toArray()
      res.send(result)
    })

    // user related
app.get('/users',async(req,res)=>{
  const result=await userCollections.find().toArray()
  res.send(result)
})

    app.post('/users',async(req,res)=>{
      const user=req.body
      const exists=await userCollections.findOne({email:user.email})
      if(exists){
        return res.send({message:'user already exists'})
      }
      const result=await userCollections.insertOne(user)
      res.send(result)
    })

    // classes related 
    app.get('/classes',async(req,res)=>{
      const sort=req.query.sort
      const limit=parseInt(req.query.limit )||6
      const page=parseInt(req.query.page)||0
      const skip=page*limit
      let result=[]
       if(sort===1){
        result=await classCollections.find().sort({enrolledStudents:-1}).limit(6).toArray()
       }
       else{
        result=await classCollections.find().skip(skip).limit(limit).toArray()
       }
     
      res.send(result)
    })

    app.get('/class/:id',async(req,res)=>{
      const id=req.params.id
      const result=await classCollections.findOne({_id: new ObjectId(id)})
      res.send(result)
    })

    app.get('/classesCount', async(req,res)=>{
      const count=await classCollections.countDocuments()
      res.send({totalCounts:count})
    })


    //  class cart related 
    app.post('/cartClass', verifyToken, async(req,res)=>{
      const user=req.query.email
      const courseName=req.query.courseName
      const price=req.query.price

      const classCart=await classCartCollections.findOne({user})
      if(classCart){
        const exist=classCart.classInfo.find(item=>item.courseName===courseName)
        if(!exist){
          await classCartCollections.updateOne({user}, {$push:{classInfo:{courseName,price}}})
        }
       else{
        return res.send({error:true,message:'already exists'})
       }
      }
      else{
        const newCart={
          user,
          classInfo:[{courseName,price}]
        }
        await classCartCollections.insertOne(newCart)
      }
      res.send({error:false, message:'successfully added'})
    })

    // reviews related 
    app.get('/reviews',async(req,res)=>{
      const result=await reviewCollections.find().toArray()
      res.send(result)
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
    res.send('linguaAdventure is running now')
})


app.listen(port)