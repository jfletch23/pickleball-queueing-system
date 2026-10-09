import express from "express";
import { MongoClient, ObjectId} from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
await client.db("admin").command({ ping: 1 });
console.log("Connected to MongoDB");

const db = client.db("PickleballDB");

const app = express();
app.use(express.json());

const practices = db.collection("practices");
const queueChips = db.collection("queue_chips");
const parties = db.collection("parties");
const MAX_PARTY_SIZE = 4;

//Makes it so practice code is basically a primary key sorted by ascending order
await practices.createIndex({ code: 1 }, { unique: true });
//A player can only be in one party per practice (also blocks double-click duplicates)
await parties.createIndex({ practiceCode: 1, players: 1 }, { unique: true });

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

//Basically defining an ENUM in Javascript
export const QUEUE_STATUS = Object.freeze({
  WAITING: 'waiting',
  PLAYING: 'playing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const createPractice = async (req, res) => {
  const { username, password, numCourts } = req.body;
  //Basic data validation, check username and password exist, check numCourts is an integer greater than 0
  if (!username || !password || !Number.isInteger(numCourts) || numCourts < 1) {
      res.status(400).json({error : "Username, password, and numCourts must be valid inputs"})
      return
  }

  const user = {
    id: new ObjectId(),
    username: username.trim(),
    password: password.trim(),
  }

  const practice = {
    players: [user],
    admins: [user.id],
    code: makeCode(),
    numCourts: numCourts,
  }
  try {
    const result = await practices.insertOne(practice)
    res.status(200).json(practice)
  } catch (err) {
    if (err.code === 11000) {
      res.status(500).json({error : "Practice code already exists, please try again"})
      return
    }
    else {
      res.status(500).json({error: err})
      return
    }
  }
  
}

const checkPracticeExists = async (req, res, next) => {
  try {
    const result = await practices.findOne({"code" : req.params.code})
    if (!result) {
      res.status(404).json({error : "Practice not found"})
    }
    else {
      req.practice = result
      next()
    }
  } catch (err) {
    res.status(500).json({error : err})
  }
}

const getPractice = async (req, res) => {
  res.status(200).json(req.practice)
}

const deletePractice = async (req, res) => {
  try {
    const [practiceResult, chipsResult] = await Promise.all([
      practices.deleteOne({code : req.params.code}),
      queueChips.deleteMany({practiceCode : req.params.code}),
      parties.deleteMany({practiceCode: req.params.code})
    ])
    if (practiceResult.acknowledged != true || chipsResult.acknowledged != true) {
      res.status(500).json({error : "Error connecting to MongoDB"})
      return
    }
    if (practiceResult.deletedCount === 0) {
      res.status(400).json({error : "Error practice not deleted"})
      return
    }
    res.status(200).json({practiceResult : practiceResult, chipsResult: chipsResult})
  } catch (err) {
    res.status(500).json({error : err})
  }
}

const joinPractice = async (req, res) => {
  const code = req.params.code
  const username = req.body.username.trim()
  const password = req.body.password.trim()
  if (!username || !password) {
    res.status(400).json({error : "Username and password are required"})
    return
  }
  try {
    const practice = req.practice
    const player = practice.players.find(player => player.username === username)
    if (!player) {
      const user = {
        id: new ObjectId(),
        username: username, 
        password: password, 
      };
      const result = await practices.findOneAndUpdate(
        {code: code},
        {
          $push: {
            players: user
          }
        },
        {returnDocument: "after"}
      )
      if (!result) {
        res.status(500).json({error : "Could not update players array in specified practice"})
        return
      }
      else {
        res.status(200).json({result, user})
        return
      }
    } //end of if block saying player does not exist
    //player does exist
    else {
      if (player.password === password) {
        const existing_user = await practices.findOne({"code" : code, "players.username" : username, "players.password": password}, {projection: {_id: 0, "players.$" : 1}})
        const isAdmin = practice.admins.some((item) => (item.toString() === existing_user.players[0].id.toString()))
        const complete_user = existing_user.players[0]
        complete_user.isAdmin = isAdmin
        res.status(201).json({success : "Successfully logged in", practice: practice, user: complete_user})
        return
      }
      else {
        res.status(400).json({error : "Wrong password entered"})
        return
      }
    }
  //Catch block for both getting the practice and updating the players array in the practice
  } catch (err) {
    res.status(500).json({error : err})
    return
  }
}

const getDashboardState = async (practice, practiceCode) => {
  const chips = await queueChips.find({practiceCode: practiceCode, status: {$in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.PLAYING]}}).sort({createdAt: 1}).toArray()
  const playerMap = new Map(practice.players.map((player) => [player.id.toString(), player]))

  const hydratedChips = chips.map((chip) => ({
    ...chip,
    players: (chip.players).map((playerId) => {
      const foundPlayer = playerMap.get(playerId.toString())
      if (!foundPlayer) {
        return {id: playerId, username: "Unknown player"}
      }
      const {password, ...otherData} = foundPlayer;
      return otherData
    })
  }))
  
  const queue = hydratedChips.filter((item) => item.status === QUEUE_STATUS.WAITING)
  const courts = hydratedChips.filter((item) => item.status === QUEUE_STATUS.PLAYING)
  return {queue: queue, courts: courts}
}

//POST request for enqueuing a player will include practice code in endpoint and player ID in body
const enqueuePlayer = async (req, res) => {
  const code = req.params.code
  const playerId = req.body.playerId

  try {
    //One queueChip will have the following information upon creation
    //id
    //practiceCode it is associated with
    //players array of users
    //status (waiting or playing or completed)
    //createdAt (timestamp to rank queue chips)
    //courtNumber: null
    //playingStartTime: null
    //Two null values will get populated when queueChip becomes playing status

    //Gets queueChips associated with practiceCode and status of waiting
    //Then does an expression (like a query I think) to get documents with a playerIds array size of less than 4
    //Then sort that output so oldest is first in the array
    //Then do a push to update that 1 gotten queueChip with the new playerId
    //The order is a little misleading, but it filters, uses options to narrow the filter to 1, and then updates that 1
    const updateChip = await queueChips.findOneAndUpdate(
    //FILTER object
    {
      practiceCode: code, 
      status: QUEUE_STATUS.WAITING, 
      $expr: { $lt: [{$size: "$players"}, 4]}
    },
    {
      $push: {players : new ObjectId(playerId)}

    },
    //OPTIONS object
    {
      sort: {createdAt: 1},
      //Rather than returning the found one it returns the updated one to updateChip constant
      returnDocument: 'after'
    })
    //Note updateChip will be null if it finds nothing from the filter, it won't try to update on null
    //If no open chips, create a new queueChip
    if (!updateChip) {
      const queueChip = {
        practiceCode : code,
        players : [new ObjectId(playerId)],
        status: QUEUE_STATUS.WAITING,
        createdAt : new Date(),
        courtNumber : null,
        playingStartTime : null
      }
      const result = await queueChips.insertOne(queueChip)
      queueChip._id = result.insertedId
      //Get updated state to respond with
      const newState = await getDashboardState(req.practice, code)
      res.status(200).json(newState)
      return
    }
    else {
      //Get updated state to respond with
      const newState = await getDashboardState(req.practice, code)
      res.status(200).json(newState)
      return
    }    
  } catch (err) {
    res.status(500).json({error : err})
    return
  }
}

//POST request for readying queue chip will include queueChip ID and court number
const readyQueueChip = async (req, res) => {
  const code = req.params.code
  const queueChipId = req.body.queueChipId
  const courtNumber = req.body.courtNumber
  if (courtNumber > req.practice.numCourts) {
    res.status(400).json({error : "Invalid court number entered"})
  }
  try {
    const update = await queueChips.updateOne({practiceCode: code, _id: new ObjectId(queueChipId)}, 
      {$set: {status: QUEUE_STATUS.PLAYING, 
              courtNumber: courtNumber, 
              playingStartTime: Date.now()}})
    
    if (update.modifiedCount === 0) {
      res.status(500).json({error : "Failed to update queue status to playing"})
    }
    //Respond with updated state of dashboard (queue chips and courts)
    const newState = await getDashboardState(req.practice, code)
    res.status(200).json(newState)
  } catch (err) {
    res.status(500).json({error : err})
  }
}

//This gets both the queue chips that are on courts and in the queue (the complete state of the dashboard)
//Main logic is in helper function getDashboardState
const getState = async (req, res) => {
  const code = req.params.code
  try {
    const state = await getDashboardState(req.practice, code)
    res.status(200).json(state)
  } catch (err) {
    res.status(500).json({error : err})
  }
}

//POST request with body of queueChip ID for the court that is ending and the court number of that court
//4 step process:
//1: set queueChip with given ID to COMPLETED status (yes for now deciding to keep queue chips around but they are deleted at the end of a practice)
//2: Find oldest queue chip with status of waiting
//3: Set that queue chip's status to playing
//4: Get updated state
const endGame = async (req, res) => {
  const code = req.params.code
  const queueChipId = req.body.queueChipId
  const courtNumber = req.body.courtNumber
  try {
    const update_court = await queueChips.updateOne({practiceCode: code, _id: new ObjectId(queueChipId)}, {$set: {status: QUEUE_STATUS.COMPLETED, courtNumber: null, playingStartTime: null}})
    if (update_court.modifiedCount === 0) {
      res.status(400).json({error : "Failed to update queue chip to completed status"})
    }
    //DESIGN CHOICE: only readies queue chips with 4 players, which means there could theoretically be no queue chips left to be readied but that is ok because that could also happen if no one is in the queue. Just going to result in an empty court
    const ready_chip = await queueChips.findOneAndUpdate({practiceCode: code, status: QUEUE_STATUS.WAITING, $expr: { $eq: [{$size: "$players"}, 4]}}, {$set: {status: QUEUE_STATUS.PLAYING, courtNumber: courtNumber, playingStartTime : new Date()}}, {sort: {createdAt: 1}, returnDocument: "after"})
    const new_state = await getDashboardState(req.practice, code)
    res.status(200).json(new_state)
  } catch (err) {
    res.status(500).json({error : err})
  }
}
const getPartiesState = async (practiceCode) => {
  return await parties.find({practiceCode: practiceCode}).sort({createdAt: 1}).toArray()
}
const checkPartyExists = async (req, res, next)=>{
  const partyId = new ObjectId(req.params.partyId)
  if(!partyId){
    res.status(400).json({error: "invalid party"})
    return
  }
  try{
    const party = await parties.findOne({_id: partyId, practiceCode: req.params.code})
    if(!party){
      res.status(404).json({error: "party not found"})
      return
    }
    req.party = party
    next()
  } catch(err){
    res.status(500).json({error : err.message})

  }

}
const getParties = async (req, res) => {
  try {
    const partyList = await getPartiesState(req.params.code)
    res.status(200).json({parties: partyList})
  } catch (err) {
    res.status(500).json({error : err.message})
  }
}
//create party
const createParty = async (req, res)=>{
  const code = req.params.code
  const playerId = new ObjectId(req.body.playerId)
  if(!playerId ){
    res.status(400).json({error:"playerid not valid"})
    return
  }
  try {
    const existing = await parties.findOne({
      practiceCode: code,
      players: playerId,
    });
    if (existing) {
      res.status(400).json({ error: "Player is alreay in this party" });
      return;
    }
    await parties.insertOne({
      practiceCode: code,
      leaderId: playerId,
      players: [playerId],
      requests: [],
      createdAt: new Date(),
    });

    const partyList = await parties.find({ practiceCode: code }).toArray();
    res.status(200).json({ parties: partyList });
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: "Player is already in a party" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
}

//send party request
const requestJoinParty = async (req, res)=>{
  const code = req.params.code
  const playerId = new ObjectId(req.body.playerId)
  
  if(!playerId){
    res.status(400).json({error: "not a valid player"})
    return
  }
  try {
    const existing = await parties.findOne({practiceCode: code, players: playerId})
    if(existing){
      res.status(400).json({error: " already in a part leave to request "})
      return
    }
    

    const result = await parties.updateOne(
      {
        _id: req.party._id,
        "requests.playerId": {$ne: playerId},
        $expr: {$lt: [{$size: "$players"}, MAX_PARTY_SIZE]}
      },
      {$push: {requests: {playerId: playerId, requestedAt: new Date()}}}
    )
    if (result.matchedCount === 0) {
      res.status(400).json({error : "Party is full or request was already sent"})
      return
    }
    const partyList = await getPartiesState(code)
    res.status(200).json({parties: partyList})
  } catch (err) {
    
  }
}

const cancelJoinRequest = async (req, res)=>{
  const code = req.params.code
  if (!ObjectId.isValid(req.body.playerId)) {
    res.status(400).json({error: "not a valid player"})
    return
  }
  const playerId = new ObjectId(req.body.playerId)
  try {
    await parties.updateOne({_id: req.party._id}, {$pull: {requests: {playerId: playerId}}})
    const partyList = await getPartiesState(code)
    res.status(200).json({parties: partyList})
  } catch (err) {
    res.status(500).json({error : err.message})
  }

}

//accept invite
const respondToJoinRequest = async (req, res)=>{
const code = req.params.code
if (!ObjectId.isValid(req.body.leaderId) || !ObjectId.isValid(req.body.playerId)) {
  res.status(400).json({error: "Valid leaderId and playerId are required"})
  return
}
const leaderId = new ObjectId(req.body.leaderId)
const playerId = new ObjectId(req.body.playerId)
const accept = req.body.accept === true
if (!leaderId || !playerId) {
  
}
if (!req.party.leaderId.equals(leaderId)) {
  res.status(403).json({error: "Only the part leader can accept request"})
  return
}

try {
  if(!accept){
    await parties.updateOne({_id: req.party._id}, {$pull: {requests: {playerId: playerId}}})
    const partyList = await getPartiesState(code)
    res.status(200).json({parties: partyList})
    return
  }
  //One atomic update: only works if the request exists and the party still has room
    const updated = await parties.findOneAndUpdate(
      {
        _id: req.party._id,
        "requests.playerId": playerId,
        $expr: {$lt: [{$size: "$players"}, MAX_PARTY_SIZE]}
      },
      {
        $push: {players: playerId},
        $pull: {requests: {playerId: playerId}}
      },
      {returnDocument: "after"}
      
    )
    if (!updated) {
      res.status(400).json({error : "Request not found or party is full"})
      return
    }
    //Player is in a party now, so drop their requests to every other party
    await parties.updateMany({practiceCode: code}, {$pull: {requests: {playerId: playerId}}})
    const partyList = await getPartiesState(code)
    res.status(200).json({parties: partyList})
} catch (err) {
  if (err.code === 11000) {
      res.status(400).json({error : "Player already joined another party"})
      return
    }
    res.status(500).json({error : err.message})
  }
}

//leave party
const leaveParty = async (req, res)=>{
  const code = req.params.code
  const playerId = new ObjectId(req.body.playerId)
  if(!playerId || !req.party.players.some((id) => id.equals(playerId))){
    res.status(400).json({error : "Player is not in this party"})
    return
  }
    const remaining = req.party.players.filter((id) => !id.equals(playerId))
    try {
      if(remaining.length === 0){
        await parties.deleteOne({_id: req.party._id})
      }else{
        const newLeaderId = req.party.leaderId.equals(playerId)? remaining[0]: req.party.leaderId
        await parties.updateOne({_id: req.party._id}, {$pull: {players: playerId}, $set: {leaderId: newLeaderId}})
      }
      const partyList = await getPartiesState(code)
      res.status(200).json({parties: partyList})
    } catch (err) {
      res.status(500).json({error : err.message})
    }
}
const enqueueParty = async(req, res)=>{
  const code = req.params.code

  if (!ObjectId.isValid(req.body.leaderId)) {
    res.status(400).json({ error: "not a valid id" })
    return
  }
  const leaderId = new ObjectId(req.body.leaderId)
   if (!req.party.leaderId.equals(leaderId)) {
    res.status(403).json({error : "Only the party leader can put the party in the queue"})
    return
  }
  const partyPlayers = req.party.players
  try {
    const updateChip = await queueChips.findOneAndUpdate({
        practiceCode: code,
        status: QUEUE_STATUS.WAITING,
        $expr: {$lte: [{$size: "$players"}, MAX_PARTY_SIZE - partyPlayers.length]}
      },
      {$push: {players: {$each: partyPlayers}}},
      {sort: {createdAt: 1}, returnDocument: "after"})
      // chip without room create new chip
      if(!updateChip){
        await queueChips.insertOne({
          practiceCode: code,
        players: partyPlayers,
        status: QUEUE_STATUS.WAITING,
        createdAt: new Date(),
        courtNumber: null,
        playingStartTime: null
        })
      }
      await parties.deleteOne({_id: req.party._id})
          const [dashboard, partyList] = await Promise.all([getDashboardState(code), getPartiesState(code)])
          res.status(200).json({...dashboard,parties: partyList})
  } catch (err) {
        res.status(500).json({error : err.message})
  }
}

app.get("/api/practice/:code/parties", checkPracticeExists, getParties)
app.post("/api/practice/:code/party/:partyId/request", checkPracticeExists, checkPartyExists, requestJoinParty)
app.post("/api/practice/:code/party/:partyId/request/cancel", checkPracticeExists, checkPartyExists, cancelJoinRequest)
app.post("/api/practice/:code/party/:partyId/request/respond", checkPracticeExists, checkPartyExists, respondToJoinRequest)
app.post("/api/practice/:code/party/:partyId/leave", checkPracticeExists, checkPartyExists, leaveParty)
//Mostly just making this endpoint for testing purposes, not sure when it will be implemented on the client (if at all)
const appointAdmin = async (req, res) => {
  const code = req.params.code
  const playerId = req.body.playerId
  try {
    const appoint = await practices.updateOne({code: code}, {$push: {admins: new ObjectId(playerId)}})
    res.status(200).json({output : appoint})
  } catch (err) {
    res.status(500).json({error : err})
  }
}

app.post("/api/create/practice", createPractice)
app.post("/api/practice/:code/party/create", checkPracticeExists, createParty)
app.post("/api/practice/:code/party/:partyId/enqueue", checkPracticeExists, checkPartyExists, enqueueParty)


//Custom middleware to check given practice code exists in the database, 
//Need to define it in the .get or .delete or .post because that way it can get the URL parameter for the practice code
app.get("/api/practice/:code", checkPracticeExists, getPractice)
app.delete("/api/practice/:code/delete", checkPracticeExists, deletePractice)
app.post("/api/practice/:code/join", checkPracticeExists, joinPractice)
app.post("/api/practice/:code/player/enqueue", checkPracticeExists, enqueuePlayer)
app.get("/api/practice/:code/state", checkPracticeExists, getState)
app.post("/api/practice/:code/queue/ready", checkPracticeExists, readyQueueChip)
app.post("/api/practice/:code/game/end", checkPracticeExists, endGame)
app.post("/api/practice/:code/player/appointadmin", checkPracticeExists, appointAdmin)

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
