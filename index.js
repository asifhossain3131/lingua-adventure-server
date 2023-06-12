const express=require('express')
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt=require('jsonwebtoken')
const stripe = require("stripe")(`${process.env.STRIPE_SECRET_KEY}`);



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
    const paymentCollections=client.db('linguaAdventure').collection('payments')
    
    
     
    
    // jwt related 
    app.post('/jwt',(req,res)=>{
      const user=req.body
      const token=jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'2h'})
      res.send({token})
    })

    const verifyAdmin=async (req,res,next)=>{
      const email=req.decoded.email
      const filter={email:email}
      const user=await userCollections.findOne(filter)
      if(user?.role!=='admin'){
        return res.status(403).send({error:true, message:'forbidden access'})
      }
      next()
    }

    const verifyInstructor=async (req,res,next)=>{
      const email=req.decoded.email
      const filter={email:email}
      const user=await userCollections.findOne(filter)
      if(user?.role!=='instructor'){
        return res.status(403).send({error:true, message:'forbidden access'})
      }
      next()
    }    

    // payment intent related 
    app.post("/create-payment-intent",verifyToken, async (req, res) => {
      const {price}= req.body;
      const totalPrice=parseInt(price*100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: "usd",
        payment_method_types: ['card']
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // sliders related 
    app.get('/sliders', async(req,res)=>{
      const result=await sliderCollections.find().toArray()
      res.send(result)
    })

    // user related
app.get('/users',verifyToken,verifyAdmin, async(req,res)=>{
  const result=await userCollections.find().toArray()
  res.send(result)
})

app.get('/users/role/:email', verifyToken, async(req,res)=>{
  const email=req.params.email
  const filter={email: email}
  const user=await userCollections.findOne(filter)
  if(req.decoded.email!==email){
    return res.send({role:false})
  }
  const result={role: user?.role}
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

    app.patch('/user/:id',verifyToken,verifyAdmin, async(req,res)=>{
      const filter={_id:new ObjectId(req.params.id)}
      const role=req.query.role
      const updateUser={
        $set:{
          role:role
        }
      }
      const result=await userCollections.updateOne(filter,updateUser)
      res.send(result)
    })

    app.delete('/user/:id',verifyToken,verifyAdmin,async(req,res)=>{
      const filter={_id:new ObjectId(req.params.id)}
      const result=await userCollections.deleteOne(filter)
      res.send(result)
    })

    // instructor related 
    app.get('/instructors', async(req,res)=>{
const sort=req.query.sort
let result
if(sort>0){
result=await instructorCollections.find().sort({followers:-1}).limit(6).toArray()
}
else{
result=await instructorCollections.find().toArray()
}
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

    app.get('/classes/:courseName',async(req,res)=>{
      const result=await classCollections.findOne({classname:req?.params?.courseName})
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

    app.get('/instructorClasses/:instructorName',verifyToken,verifyInstructor,async(req,res)=>{
      const result=await classCollections.find({instructorName:req.params.instructorName}).toArray()
      res.send(result)
    })

    app.post('/classes',verifyToken,verifyInstructor, async(req,res)=>{
      const classInfo=req.body
      const result=await classCollections.insertOne(classInfo)
      res.send(result)
    })


    //  class cart related 
    app.get('/cartClass',verifyToken, async(req,res)=>{
      const email=req?.query?.email
      if(!email){
       res.send([])
      }
    
      if(req.decoded.email!==email){
        return res.status(403).send('forbidden access')
      }
      
      const query={user:email}
      const result=await classCartCollections.findOne(query)
      res.send(result)
    })

    app.post('/cartClass', verifyToken, async(req,res)=>{
      const user=req.query.email
      const courseName=req.query.courseName
      const course=await classCollections.findOne({classname:courseName})
      if(course){
        const{classname,price,totalSeats,enrolledStudents}=course
        const avilableSeats=totalSeats-enrolledStudents
 
        const classCart=await classCartCollections.findOne({user})
        if(classCart){
          const exist=classCart.classInfo.find(item=>item.courseName===courseName)
          if(!exist){
            await classCartCollections.updateOne({user}, {$push:{classInfo:{courseName,price,avilableSeats}}})
          }
         else{
          return res.send({error:true,message:'already exists'})
         }
        }
        else{
          const newCart={
            user,
            classInfo:[{courseName,price,avilableSeats}]
          }
          await classCartCollections.insertOne(newCart)
        }
        res.send({error:false, message:'successfully added'})
      }
    })

    app.patch('/cartClass/:courseName', verifyToken, async(req,res)=>{
      const course=req.params.courseName
      const email=req.query.email
      const filter={user:email}
      const updated={$pull:{classInfo:{courseName:course}}}
      const result=await classCartCollections.updateOne(filter,updated)
      res.send(result)
    })

    // reviews related 
    app.get('/reviews',async(req,res)=>{
      const result=await reviewCollections.find().toArray()
      res.send(result)
    })

    // payments related 
    app.get('/payments/:email', verifyToken,async(req,res)=>{
      const email=req.params.email
      const paymentHistory = await paymentCollections.findOne({ email: email });
      if (!paymentHistory) {
        return res.status(404).send({ error: true, message: 'Payment history not found' });
      }
      const sortedHistory = paymentHistory.enrolledClasses.sort((a, b) => new Date(b.date) - new Date(a.date));
      res.json(sortedHistory);
    })

    //  helper function 
    const modifyDatabase=async(courseName,email,res)=>{
      const updatedClass=await classCollections.findOneAndUpdate(
        {classname:courseName},
        {$inc:{enrolledStudents:1}}
      )
      if(updatedClass.ok===1){
        const removedFromClassCart=await classCartCollections.updateOne({user:email},{$pull:{classInfo:{courseName:courseName}}})
        if(removedFromClassCart.modifiedCount>0){
          // to-do implement email sending 
        return  res.status(200).send({message:'Payment successful'})
        }
      }
    }

    app.post('/payments',verifyToken,async(req,res)=>{
      const paymentInfo=req.body
      const{email,courseName,transId,price,date,instructor}=paymentInfo
     const paymentHistories=await paymentCollections.findOne({email:email})
     if(paymentHistories){
       const exist=paymentHistories.enrolledClasses.find(item=>item.courseName===courseName)
       if(!exist){
        const newCourse= await paymentCollections.updateOne({email:email}, {$push:{enrolledClasses:{courseName,transId,date,price,instructor}}})
         if(newCourse.modifiedCount>0){
          modifyDatabase(courseName,email,res)
         }
       }
      else{
       return res.send({error:true,message:'already exists'})
      }
     }
     else{
       const newCart={
         email:email,
         enrolledClasses:[{courseName,transId,date,price,instructor}]
       }
       const newCourse=await paymentCollections.insertOne(newCart)
      if(newCourse.acknowledged===true){
        modifyDatabase(courseName,email,res)
      }
     }
    })

    // enrolledClasses related 
    app.get('/enrolledClasses/:email', verifyToken,async(req,res)=>{
      const email=req.params.email
      if(!email){
        return res.send({})
      }
      if(req.decoded.email!==email){
        return res.status(403).send({error:true,message:'forbidden access'})
      }
      const result=await paymentCollections.findOne({email:email})
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