const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const { default: Stripe } = require("stripe");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qlklf.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    client.connect();

    console.log("database connected");
    const database = client.db("e-mart");
    const productCollection = database.collection("products");
    const shippingCollection = database.collection("shipping");
    const userCollections = database.collection("users");

    // get all the products
    app.get("/products", async (req, res) => {
      const cursor = productCollection.find({});
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let result;
      if (page) {
        result = await cursor.limit(size).toArray();
      } else {
        result = await cursor.toArray();
      }
      res.json(result);
    });

    //get single products
    app.get("/products/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const result = await productCollection.findOne({ _id: new ObjectId(id) });
      console.log(result);

      res.json(result);
    });

    // add products
    app.post("/products", async (req, res) => {
      const product = req.body;

      const result = await productCollection.insertOne(product);
      res.json(result);
    });

    // add reviews
    app.put("/products/:id", async (req, res) => {
      const { id } = req.params;
      const { ...data } = req.body;
      console.log(req.body);
      const result = await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $push: { reviews: data } }
      );
      res.json(result);
    });

    // delete products
    app.delete("/products/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const result = await productCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // user shipping products
    app.post("/shipping", async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const result = await shippingCollection.insertOne(payment);
      res.json(result);
    });

    app.get("/order", async (req, res) => {
      const query = {};
      const result = await shippingCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/order/:email", async (req, res) => {
      const { email } = req.params;
      const result = await shippingCollection.find({ email: email }).toArray();
      res.send(result);
    });

  
    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await userCollections.insertOne(user);
      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const query = {};
      const result = await userCollections.find(query).toArray();
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await userCollections.findOne(query);

      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "2h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await userCollections.deleteOne(query);
      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollections.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.put("/user/admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = userCollections.updateOne(query, updatedDoc, options);
      res.send(result);
    });

    app.put("/user/vendor/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          title: "vendor",
        },
      };
      const result = userCollections.updateOne(query, updatedDoc, options);
      res.send(result);
    });

    app.get("/user/vendor/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollections.findOne(query);
      res.send({ isVendor: user?.title === "vendor" });
    });

    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const booking = req.body;
      const price = booking.totalAmount;
      const amount = parseInt(price) * 100;
      console.log(amount);

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server running");
});

app.listen(5000, () => {
  console.log("listening to port", port);
});
