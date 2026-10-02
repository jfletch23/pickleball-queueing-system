import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type Player = {
  id: number;
  username: string;
  skill: string;
};

function App() {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    fetch("/api/players")
      .then((res) => res.json())
      .then(setPlayers);
  }, []);

  return (
    <>
      <h1 className="text-4xl font-bold text-blue-600 underline">
        pickleball queueing system
      </h1>
      <Button>My button</Button>
      <ul>
        {players.map((p) => (
          <li key={p.id}>
            {p.username}: {p.skill}
          </li>
        ))}
      </ul>
    </>
  );
}

export default App;
