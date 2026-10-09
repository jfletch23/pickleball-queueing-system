import { useEffect, useRef } from "react";

type Handlers<T> = { onState: (state: T) => void; onPartyState: (state: T) => void; onDeleted?: () => void };

export function useQueueSocket<T>(code: string | undefined, handlers: Handlers<T>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!code) return;
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);

      ws.onopen = () => {
        retry = 0;
        ws!.send(JSON.stringify({ type: "join", code}));
        ws!.send(JSON.stringify({type: "party", code}))
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "state") {
          handlersRef.current.onState(msg.state)
        }
        else if (msg.type === "party") {
          handlersRef.current.onPartyState(msg.partyState)
        }
        else if (msg.type === "practice_deleted") {
          handlersRef.current.onDeleted?.()
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [code]);
}