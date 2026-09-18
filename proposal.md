**Final Project Proposal**

**Team members**:  
Justin Fletcher, Max Gambino, Casey Pietrusewicz, Josue Hernandez

**Technologies**:   
Frontend: React, TypeScript, Tailwind CSS, a to be determined component library (we are open to suggestions)  
Backend: Express, MongoDB  
Deployment: Render  
Misc: [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) for notifications

**Description**:

Our project is going to be a queue management system for WPI’s club pickleball practices. At club pickleball practices, there are 4 courts for 4 people each, so when more than 16 people show up to play, there needs to be a queue system to organize it. 

We want to make a website that allows our users to create a session for each practice, and users would create accounts to uniquely identify themselves and save state. We imagine this working similarly to the website When2meet, which allows users to create an event and associate an account with that event. When you create an account for that event, you enter your name and your skill level to make sure you are grouped with people similar to your skill level to have good games. The user to make the session is considered an admin account. The admin account would be responsible for some settings such as the number of courts. They would also be responsible for pressing a button when the current games end to move the queue along. We will be storing usernames and passwords as plain text in MongoDB, but all of the data will be deleted at the end of the session. For other users to join a session, they would enter a unique code associated with the session.   

The user can join a game at or below the skill level they set themselves at. You can either choose a specific game with an open spot to join, or you can be automatically placed into a game around your skill level. We will also keep track of where each game is and how long they have been going on, so people in the queue will know roughly when they will be up and where they will be. We will be implementing a party feature so users can group up and play together. Whoever creates the party will be the party leader. Joining the queue in a party will put you in the first available game that can fit the entire party. Joining a specific game will not be allowed unless the entire party can fit.

One key feature of our project is a responsive web design so that our webapp looks nice on both desktops and mobile devices. The last additional feature we would like to implement is web push notifications so users will be notified when it is their turn to play. 

