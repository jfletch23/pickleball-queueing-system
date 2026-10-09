import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import http from "http";
import { WebSocketServer } from "ws";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
await client.db("admin").command({ ping: 1 });
console.log("Connected to MongoDB");

const db = client.db("PickleballDB");

const app = express();
app.use(express.json());

const practices = db.collection("practices");
const queueChips = db.collection("queue_chips");

//Makes it so practice code is basically a primary key sorted by ascending order
await practices.createIndex({ code: 1 }, { unique: true });

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function fillEmptyCourts(code, numCourts) {
  const playing = await queueChips
    .find(
      { practiceCode: code, status: QUEUE_STATUS.PLAYING },
      { projection: { courtNumber: 1 } },
    )
    .toArray();
  const taken = new Set(playing.map((c) => c.courtNumber));

  for (let n = 1; n <= numCourts; n++) {
    if (taken.has(n)) continue;
    const chip = await queueChips.findOneAndUpdate(
      {
        practiceCode: code,
        status: QUEUE_STATUS.WAITING,
        $expr: { $eq: [{ $size: "$players" }, 4] },
      },
      {
        $set: {
          status: QUEUE_STATUS.PLAYING,
          courtNumber: n,
          playingStartTime: Date.now(),
        },
      },
      { sort: { createdAt: 1 } },
    );
    if (!chip) break;
  }
}

async function pushState(req, res) {
  const code = req.params.code;
  await fillEmptyCourts(code, req.practice.numCourts);
  const state = await getDashboardState(req.practice, code);
  broadcast(code, { type: "state", state });
  res.status(200).json(state);
}

async function removeFromWaitingChips(code, playerOid, exceptId = null) {
  const filter = {
    practiceCode: code,
    status: QUEUE_STATUS.WAITING,
    players: playerOid,
  };
  if (exceptId) filter._id = { $ne: exceptId };
  await queueChips.updateMany(filter, { $pull: { players: playerOid } });
  await queueChips.deleteMany({
    practiceCode: code,
    status: QUEUE_STATUS.WAITING,
    players: { $size: 0 },
  });
}

const findActiveChip = (code, playerOids) =>
  queueChips.findOne({
    practiceCode: code,
    status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.PLAYING] },
    players: { $in: playerOids },
  });

const isValidId = (id) => typeof id === "string" && ObjectId.isValid(id);

//Basically defining an ENUM in Javascript
export const QUEUE_STATUS = Object.freeze({
  WAITING: "waiting",
  PLAYING: "playing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

const createPractice = async (req, res) => {
  const { username, password, numCourts } = req.body;
  //Basic data validation, check username and password exist, check numCourts is an integer greater than 0
  if (!username || !password || !Number.isInteger(numCourts) || numCourts < 1) {
    res.status(400).json({
      error: "Username, password, and numCourts must be valid inputs",
    });
    return;
  }

  const user = {
    id: new ObjectId(),
    username: username.trim(),
    password: password.trim(),
  };

  const practice = {
    players: [user],
    admins: [user.id],
    code: makeCode(),
    numCourts: numCourts,
  };
  try {
    const result = await practices.insertOne(practice);
    res.status(200).json(practice);
  } catch (err) {
    if (err.code === 11000) {
      res
        .status(500)
        .json({ error: "Practice code already exists, please try again" });
      return;
    } else {
      res.status(500).json({ error: err });
      return;
    }
  }
};

const checkPracticeExists = async (req, res, next) => {
  try {
    const result = await practices.findOne({ code: req.params.code });
    if (!result) {
      res.status(404).json({ error: "Practice not found" });
    } else {
      req.practice = result;
      next();
    }
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

const getPractice = async (req, res) => {
  res.status(200).json(req.practice);
};

const deletePractice = async (req, res) => {
  const { playerId } = req.body ?? {};
  if (
    !isValidId(playerId) ||
    !req.practice.admins.some((a) => a.toString() === playerId)
  ) {
    res.status(403).json({ error: "Only an admin can delete a practice" });
    return;
  }
  try {
    const [practiceResult, chipsResult] = await Promise.all([
      practices.deleteOne({ code: req.params.code }),
      queueChips.deleteMany({ practiceCode: req.params.code }),
    ]);
    if (
      practiceResult.acknowledged != true ||
      chipsResult.acknowledged != true
    ) {
      res.status(500).json({ error: "Error connecting to MongoDB" });
      return;
    }
    if (practiceResult.deletedCount === 0) {
      res.status(400).json({ error: "Error practice not deleted" });
      return;
    }
    broadcast(req.params.code, { type: "practice_deleted" });
    res
      .status(200)
      .json({ practiceResult: practiceResult, chipsResult: chipsResult });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

const joinPractice = async (req, res) => {
  const code = req.params.code;
  const username = req.body.username.trim();
  const password = req.body.password.trim();
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  try {
    const practice = req.practice;
    const player = practice.players.find(
      (player) => player.username === username,
    );
    if (!player) {
      const user = {
        id: new ObjectId(),
        username: username,
        password: password,
      };
      const result = await practices.findOneAndUpdate(
        { code: code },
        {
          $push: {
            players: user,
          },
        },
        { returnDocument: "after" },
      );
      if (!result) {
        res.status(500).json({
          error: "Could not update players array in specified practice",
        });
        return;
      } else {
        res.status(200).json({ result, user });
        return;
      }
    } //end of if block saying player does not exist
    //player does exist
    else {
      if (player.password === password) {
        const existing_user = await practices.findOne(
          {
            code: code,
            "players.username": username,
            "players.password": password,
          },
          { projection: { _id: 0, "players.$": 1 } },
        );
        const isAdmin = practice.admins.some(
          (item) => item.toString() === existing_user.players[0].id.toString(),
        );
        const complete_user = existing_user.players[0];
        complete_user.isAdmin = isAdmin;
        res.status(201).json({
          success: "Successfully logged in",
          practice: practice,
          user: complete_user,
        });
        return;
      } else {
        res.status(400).json({ error: "Wrong password entered" });
        return;
      }
    }
    //Catch block for both getting the practice and updating the players array in the practice
  } catch (err) {
    res.status(500).json({ error: err });
    return;
  }
};

const getDashboardState = async (practice, practiceCode) => {
  const chips = await queueChips
    .find({
      practiceCode: practiceCode,
      status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.PLAYING] },
    })
    .sort({ createdAt: 1 })
    .toArray();
  const playerMap = new Map(
    practice.players.map((player) => [player.id.toString(), player]),
  );

  const hydratedChips = chips.map((chip) => ({
    ...chip,
    players: chip.players.map((playerId) => {
      const foundPlayer = playerMap.get(playerId.toString());
      if (!foundPlayer) {
        return { id: playerId, username: "Unknown player" };
      }
      const {password, ...otherData} = foundPlayer;
      return otherData
    })
  }))
  
  const queue = hydratedChips.filter((item) => item.status === QUEUE_STATUS.WAITING)
  const courts = hydratedChips.filter((item) => item.status === QUEUE_STATUS.PLAYING)
  const sorted_courts = courts.sort((a, b) => a.courtNumber - b.courtNumber)
  return {queue: queue, courts: sorted_courts, admins: practice.admins}
}

//POST request for enqueuing a player will include practice code in endpoint and player ID in body
const enqueuePlayer = async (req, res) => {
  const code = req.params.code;
  const { playerId } = req.body;
  try {
    if (!isValidId(playerId)) {
      res.status(400).json({ error: "Invalid playerId" });
      return;
    }
    const pid = new ObjectId(playerId);
    if (await findActiveChip(code, [pid])) {
      res
        .status(409)
        .json({ error: "You're already in the queue or on a court" });
      return;
    }
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
        $expr: { $lt: [{ $size: "$players" }, 4] },
      },
      {
        $push: { players: pid },
      },
      //OPTIONS object
      {
        sort: { createdAt: 1 },
        //Rather than returning the found one it returns the updated one to updateChip constant
        returnDocument: "after",
      },
    );
    //Note updateChip will be null if it finds nothing from the filter, it won't try to update on null
    //If no open chips, create a new queueChip
    if (!updateChip) {
      const queueChip = {
        practiceCode: code,
        players: [pid],
        status: QUEUE_STATUS.WAITING,
        createdAt: new Date(),
        courtNumber: null,
        playingStartTime: null,
      };
      const result = await queueChips.insertOne(queueChip);
      queueChip._id = result.insertedId;
      await pushState(req, res);
      return;
    } else {
      await pushState(req, res);
      return;
    }
  } catch (err) {
    console.error("enqueuePlayer failed:", err);
    res.status(500).json({ error: "Server error" });
  }
};

//POST request for readying queue chip will include queueChip ID and court number
const readyQueueChip = async (req, res) => {
  const code = req.params.code;
  const queueChipId = req.body.queueChipId;
  const courtNumber = req.body.courtNumber;
  if (courtNumber > req.practice.numCourts) {
    res.status(400).json({ error: "Invalid court number entered" });
    return;
  }
  try {
    const update = await queueChips.updateOne(
      { practiceCode: code, _id: new ObjectId(queueChipId) },
      {
        $set: {
          status: QUEUE_STATUS.PLAYING,
          courtNumber: courtNumber,
          playingStartTime: Date.now(),
        },
      },
    );

    if (update.modifiedCount === 0) {
      res
        .status(500)
        .json({ error: "Failed to update queue status to playing" });
      return;
    }
    //Respond with updated state of dashboard (queue chips and courts)
    const newState = await getDashboardState(req.practice, code);
    broadcast(code, { type: "state", state: newState });
    res.status(200).json(newState);
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

//This gets both the queue chips that are on courts and in the queue (the complete state of the dashboard)
//Main logic is in helper function getDashboardState
const getState = async (req, res) => {
  const code = req.params.code;
  try {
    const state = await getDashboardState(req.practice, code);
    res.status(200).json(state);
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

//POST request with body of queueChip ID for the court that is ending and the court number of that court
//4 step process:
//1: set queueChip with given ID to COMPLETED status (yes for now deciding to keep queue chips around but they are deleted at the end of a practice)
//2: Find oldest queue chip with status of waiting
//3: Set that queue chip's status to playing
//4: Get updated state
const endGame = async (req, res) => {
  const code = req.params.code;
  const { queueChipId, courtNumber } = req.body;
  try {
    if (!isValidId(queueChipId)) {
      res.status(400).json({ error: "Invalid queueChipId" });
      return;
    }
    const update_court = await queueChips.updateOne(
      { practiceCode: code, _id: new ObjectId(queueChipId) },
      {
        $set: {
          status: QUEUE_STATUS.COMPLETED,
          courtNumber: null,
          playingStartTime: null,
        },
      },
    );
    //DESIGN CHOICE: only readies queue chips with 4 players, which means there could theoretically be no queue chips left to be readied but that is ok because that could also happen if no one is in the queue. Just going to result in an empty court
    const ready_chip = await queueChips.findOneAndUpdate(
      {
        practiceCode: code,
        status: QUEUE_STATUS.WAITING,
        $expr: { $eq: [{ $size: "$players" }, 4] },
      },
      {
        $set: {
          status: QUEUE_STATUS.PLAYING,
          courtNumber: courtNumber,
          playingStartTime: Date.now(),
        },
      },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    );
    const new_state = await getDashboardState(req.practice, code);
    //res.status(200).json(new_state)
    await pushState(req, res); // also moves the next full group onto the open court
  } catch (err) {
    console.error("endGame failed:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const leaveQueue = async (req, res) => {
  const code = req.params.code;
  const { playerId } = req.body;
  try {
    if (!isValidId(playerId)) {
      res.status(400).json({ error: "Invalid playerId" });
      return;
    }
    await removeFromWaitingChips(code, new ObjectId(playerId));
    await pushState(req, res);
  } catch (err) {
    console.error("leaveQueue failed:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const appointAdmin = async (req, res) => {
  const code = req.params.code;
  const playerId = req.body.playerId;
  try {
    const new_practice = await practices.findOneAndUpdate({code: code}, {$push: {admins: new ObjectId(playerId)}}, {"returnDocument" : "after"})
    req.practice = new_practice
    await pushState(req, res)
    //res.status(200).json({output : appoint})
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

app.post("/api/create/practice", createPractice);

//Custom middleware to check given practice code exists in the database,
//Need to define it in the .get or .delete or .post because that way it can get the URL parameter for the practice code
app.get("/api/practice/:code", checkPracticeExists, getPractice);
app.delete("/api/practice/:code/delete", checkPracticeExists, deletePractice);
app.post("/api/practice/:code/join", checkPracticeExists, joinPractice);
app.post(
  "/api/practice/:code/player/enqueue",
  checkPracticeExists,
  enqueuePlayer,
);
app.get("/api/practice/:code/state", checkPracticeExists, getState);
app.post(
  "/api/practice/:code/queue/ready",
  checkPracticeExists,
  readyQueueChip,
);
app.post("/api/practice/:code/game/end", checkPracticeExists, endGame);
app.post(
  "/api/practice/:code/player/appointadmin",
  checkPracticeExists,
  appointAdmin,
);

app.post("/api/practice/:code/queue/leave", checkPracticeExists, leaveQueue);

//TODO: party logic
//create party
//leave party
//send and get invites
//accept invite

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const rooms = new Map();

function leaveRoom(socket) {
  const room = rooms.get(socket.practiceCode);
  if (!room) return;
  room.delete(socket);
  if (room.size === 0) rooms.delete(socket.practiceCode);
}

function broadcast(code, payload) {
  const msg = JSON.stringify(payload);
  rooms.get(code)?.forEach((s) => s.readyState === 1 && s.send(msg));
}

wss.on("connection", (socket) => {
  socket.isAlive = true;
  socket.on("pong", () => (socket.isAlive = true));
  console.log("ws connection established");

  socket.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join" && typeof msg.code === "string") {
      try {
        const exists = await practices.findOne({ code: msg.code });
        if (!exists) {
          socket.send(
            JSON.stringify({ type: "error", error: "Practice not found" }),
          );
          return;
        }
        leaveRoom(socket);
        socket.practiceCode = msg.code;
        if (!rooms.has(msg.code)) rooms.set(msg.code, new Set());
        rooms.get(msg.code).add(socket);
        // send current state right away (this also resyncs after a reconnect)
        const state = await getDashboardState(exists, msg.code);
        socket.send(JSON.stringify({ type: "state", state }));
      } catch (err) {
        console.error("ws join failed", err);
      }
    }
  });

  socket.on("close", () => leaveRoom(socket));
});

setInterval(() => {
  wss.clients.forEach((s) => {
    if (!s.isAlive) return s.terminate();
    s.isAlive = false;
    s.ping();
  });
}, 30000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
