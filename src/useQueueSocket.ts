import { useEffect, useRef } from "react";
import type { DashboardState } from "./types";

//React knows this is a custom hook because of the name convention (starts with use and then has a capital letter)

//Handlers to call for different message types (state, party, or practice_deleted)
type Handlers = { onState: (state: DashboardState) => void; onPartyState: (state: DashboardState) => void; onDeleted?: () => void };

export function useQueueSocket(code: string, handlers: Handlers) {
  //Need both of these lines
  //The first line initializes my handlersRef object .current attribute to handlers on the mounting of the component
  //Does not get re-initialized when component re-renders (like when a state variable changes), so I need the second line to re-assign .current to handlers
  //A new handlers get passed every component re-render because handlers is an object, so JavaScript creates a brand new object literal everytime the page re-renders
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  //This useEffect only runs on component mount and when code changes since that is in the dependency array
  //Note the return function for the useEffect, that is the cleanup function which runs whenever code changes and then the function body runs
  useEffect(() => {
    //Define four local state variables in the useEffect, they get reset on first component mount or when code changes
    //First, the websocket which starts at null because it has not been opened yet (gets opened when connect is called)
    let ws: WebSocket | null = null;
    //Retry count, gets incremented for each time the connection drops and then gets reset to 0 when connection is re-established
    let retry = 0;
    //Stores the value returned by setTimeout function so it can be referenced to clear in the cleanup function
    //Needed to ensure that if the component unmounts while trying to re-establish the connection it stops trying to re-establish the connection
    let timer: ReturnType<typeof setTimeout>;
    //Acts as a kill switch on the hook and prevents ws.onClose from triggering twice
    let stopped = false;

    //Need connect function because it gets recursively called when websocket drops out to try to re-establish the connection
    const connect = () => {
      //Use wss if on https instead of ws protocol
      const proto = location.protocol === "https:" ? "wss" : "ws";
      //Create new websocket
      ws = new WebSocket(`${proto}://${location.host}/ws`);

      //Connecting functions to event listeners, starting with websocket on open event listener
      //When websocket first opens sends an initial message
      ws.onopen = () => {
        //Reset retry variable since I have successfully established a connection
        retry = 0;
        //Need to send some initial messages to attach the socket to a code and get the initial state, see server code for more details
        ws!.send(JSON.stringify({ type: "join", code}));
        ws!.send(JSON.stringify({type: "party", code}))
      };
      //Event listener listening for a message from websocket
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        //Call correct passed in handler function based on type of message
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
      //When websocket has closed (or have lost connection), try to reconnect
      ws.onclose = () => {
        //If kill switch is true, then don't need to try to reconnect
        if (stopped) return;
        //Runs connect again at an interval based on the amount of times retrying or a maximum of every 15 seconds
        //Note also increments retry every time connect runs again because everytime connect runs it creates a new web socket which could trigger onclose if it doesn't establish a connection
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
    };

    connect();
    //Return function cleanup code
    return () => {
      //Triggers kill switch so it doesn't try to reconnect to websocket
      stopped = true;
      //Cancels the scheduled execution of connect on its delay (could be a maximum of 15 seconds)
      clearTimeout(timer);
      //Close websocket (which would normally trigger ws.onclose to run but since stopped is true it doesn't try to reconnect)
      ws?.close();
    };
  }, [code]);
}