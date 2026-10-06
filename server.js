import express from "express";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
await client.db("admin").command({ ping: 1 });
console.log("Connected to MongoDB");

const db = client.db("PickleballDB");

const app = express();
app.use(express.json());

const practices = db.collection("practices");
await practices.createIndex({ code: 1 }, { unique: true });

// let practices = [
//   {
//     id : 1, 
//     admins: [
//     {"uuid": 123},
//     {"uuid": 456} 
//     ],
//     code: "ABC123",
//     courtsNum: 4,
//     courts: [
//       {uuid : 1},
//       {uuid: 2}
//     ],
//     parties: [
//       {partyID: 4},
//       {partyID: 7}
//     ],
//     queueChips
//   }
// ]

let players_1 = [
    { uuid: 1, username: "john", password: "password123", skill: 1},
    { uuid: 2, username: "david", password: "password123", skill: 2 },
    { uuid: 3, username: "sarah", password: "password123", skill: 3 },
];

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeCourts(n) {
  return Array.from({ length: n }, (_, i) => ({
    courtId: i + 1,
    players: [],
    startTime: null,
  }));
}

app.post("/api/practices", async (req, res) => {
  const { username, password, skillLevel, numCourts } = req.body;

  if (
    !username?.trim() ||
    !password ||
    ![1, 2, 3].includes(skillLevel) ||
    !Number.isInteger(numCourts) || numCourts < 1
  ) {
    return res.status(400).json({
      error: "username, password, skillLevel and numCourts are required",
    });
  }

  const practice = {
    admins: [],
    code: makeCode(),
    courtsNum: numCourts,
    courts: makeCourts(numCourts),
    parties: [],
    queueChips: [],
  };

  let result;
  try {
    result = await practices.insertOne(practice);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(500).json({ error: "Code collision, please try again" });
    }
    throw err;
  }

  let players;
  try {
    players = await db.createCollection(`players_${practice.code}`);
    await players.createIndex({ username: 1 }, { unique: true });

    const { insertedId: adminId } = await players.insertOne({
      username: username.trim(),
      password,
      skillLevel,
    });

    await practices.updateOne(
      { _id: result.insertedId },
      { $set: { admins: [adminId] } }
    );

    return res.status(201).json({ ...practice, admins: [adminId] });
  } catch (err) {
    await practices.deleteOne({ _id: result.insertedId });
    if (players) await players.drop();
    throw err;
  }
});

//TODO: add endpoints for the following:
//get practice state
app.get("/api/practices/:code", async (req, res) => {
  const result = await practices.findOne({"code" : req.params.code}).toArray()
  res.writeHead(200, {"Content-Type" : "application/json"})
  res.end(JSON.stringify(result))
});
//end practice
//drop player collection
app.delete("/api/delete/practices/:code", async (req, res) => {
  const delete_practice = await practices.deleteOne({"code" : req.params.code})
  const player_collection = db.collection(`players_${req.params.code}`)
  const drop_player_collection = await player_collection.drop()
  console.log(drop_player_collection)
  if (delete_practice.acknowledged != true || drop_player_collection != true) {
    res.status(504).send()
  } else if (delete_practice.deletedCount != 1) {
    res.status(505).send()
  }
  else {
    res.writeHead(200, {"Content-Type" : "application/json"})
    res.end(JSON.stringify(delete_practice))
  }
});

//add player to practice
app.post("/api/practices/:code/players", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { username, password} = req.body
  
  if(!username?.trim() || !password){
    return res.status(400).json({ error: "username and password are required" });
  }

  const practice = await practices.findOne({ code });
  if (!practice) {
    return res.status(404).json({ error: "Practice not found" });
  }

const players = db.collection(`players_${code}`);

let player = await players.findOne( { username: username.trim() });

if (player){
  if(player.password !== password){
     return res.status(401).json({ error: "Wrong Password" });
  }

}else{
  player = {username: username.trim(), password: password, skillLevel: null};
  try {
    const { insertedId } = await players.insertOne(player);
    player._id = insertedId;
    res.status(200).send()
  }catch(err){
    if (err.code === 11000){
      return res.status(409).json ({error: " Username taken try again"})
    }
    throw err
  }
}
});

//add player to queue
//take player from queue and add to court
//end game

//create party
//leave party
//send and get invites
//accept invite

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
