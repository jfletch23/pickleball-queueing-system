import express from "express";

const app = express();
app.use(express.json());

let players = [
  { id: 1, username: "john", skill: "beginner" },
  { id: 2, username: "david", skill: "intermediate" },
  { id: 3, username: "sarah", skill: "advanced" },
];

app.get("/api/players", (req, res) => {
  res.json(players);
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));