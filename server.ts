import express, { Request, Response, Application } from "express";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { v4 as uuidv4 } from 'uuid';

interface RTCOfferData {
    sdp: string;
    type: 'offer';
}

interface RTCAnswerData {
    sdp: string;
    type: 'answer';
}

interface RTCIceCandidateData {
    candidate: string;
    sdpMLineIndex: number;
    sdpMid: string;
}

const app: Application = express();
const httpServer: HttpServer = createServer(app);

const io: SocketIOServer = new SocketIOServer(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

let queue : Array< Socket > = [];
let mapOfUsersToRoomID : Map< string , string > = new Map();



function handleConnection( socket: Socket) : void {
    try {
        queue.push(socket);
        mapOfUsersToRoomID.set(socket.id , "");

        let users : Socket[]  = [];


        if( queue.length >= 2 ) {

            while( queue.length > 0 && users.length < 2 ) {
                let currUser : Socket = queue.shift()!;
                // logic to check is user whose Socket we have stored is still active
                if( currUser.connected ) {
                    users.push(currUser);
                }
            }
        
            if( users.length == 2 ) {
                // we have two users in the queue, so we can create a new room
                const newRoomId : string = uuidv4();
                users[0].join(newRoomId);
                users[1].join(newRoomId);

                // setting roomID for both users in MAP 

                mapOfUsersToRoomID.set(users[0].id , newRoomId);
                mapOfUsersToRoomID.set(users[1].id , newRoomId);
        
                // send message to both users that they are matched

                users[0].emit("matchFound" , "You are matched with another user");
                users[1].emit("matchFound" , "You are matched with another user");

                // lets make user[0] the initiator of the call
                users[0].emit("youAreInitiator" , true);
                users[1].emit("youAreInitiator" , false);
        
            }
            else{
                handleInsufficientUsers(socket, users);
            }

        }
        else{
            socket.emit("notEnoughUsers" , "Only " + queue.length + " users online" );
        }

    }
    catch (error) {
        console.error("[Error] In connectToRandomUser:", error);
        socket.emit("error", "An error occurred while matching. Please try again.");
    }
}


io.on("connection", (socket: Socket) => {

    socket.on("connectToRandomUser" , () => {
        handleConnection(socket);
    });

    socket.on("next" , ()=>{
        const roomID : string = mapOfUsersToRoomID.get(socket.id)!;
        if( roomID!=="" ){
            socket.broadcast.to(roomID).emit("userDisconnected" , "Other user has disconnected");
            socket.leave(roomID);
            mapOfUsersToRoomID.delete(socket.id);
        }
        handleConnection(socket);
    })

    socket.on("messageFromUser", (message : string) => {  // Changed to match frontend
        try {
            const roomID : string = mapOfUsersToRoomID.get(socket.id)!;
            if (!roomID) {
                console.warn(`[Warning] User ${socket.id} tried to send message without room`);
                return;
            }
            socket.broadcast.to(roomID).emit("messageFromUser", message);
        } catch (error) {
            console.error("[Error] In messageFromUser:", error);
        }
    });

    // webrtc signalling logic

    socket.on("offer", (offer: RTCOfferData) => {
        try {
            const roomID: string = mapOfUsersToRoomID.get(socket.id)!;
            if (!roomID) {
                console.warn(`[Warning] User ${socket.id} tried to send offer without room`);
                return;
            }
            socket.broadcast.to(roomID).emit("offer", offer);
        } catch (error) {
            console.error("[Error] In handling offer:", error);
            socket.emit("error", "Failed to process offer");
        }
    });

    socket.on("answer", (answer: RTCAnswerData) => {
        try {
            const roomID: string = mapOfUsersToRoomID.get(socket.id)!;
            if (!roomID) {
                console.warn(`[Warning] User ${socket.id} tried to send answer without room`);
                return;
            }
            socket.broadcast.to(roomID).emit("answer", answer);
        } catch (error) {
            console.error("[Error] In handling answer:", error);
            socket.emit("error", "Failed to process answer");
        }
    });

    socket.on("ice_candidate", (candidate: RTCIceCandidateData) => {
        try {
            const roomID: string = mapOfUsersToRoomID.get(socket.id)!;
            if (!roomID) {
                console.warn(`[Warning] User ${socket.id} tried to send ICE candidate without room`);
                return;
            }
            socket.broadcast.to(roomID).emit("ice_candidate", candidate);
        } catch (error) {
            console.error("[Error] In handling ICE candidate:", error);
        }
    });

    socket.on("localStreamSet" , ()=>{
        try {
            const roomID: string = mapOfUsersToRoomID.get(socket.id)!;
            if (!roomID) {
                console.warn(`[Warning] User ${socket.id} reported localStreamSet without room`);
                return;
            }
            socket.broadcast.to(roomID).emit("localStreamSet");
        } catch (error) {
            console.error("[Error] In handling localStreamSet:", error);
        }
    })

    socket.on("disconnect", () => {
        try {
            // Remove from queue if disconnected while waiting
            queue = queue.filter(user => user.id !== socket.id);

            // Notify other user in the room if they were matched
            const roomID = mapOfUsersToRoomID.get(socket.id);
            if (roomID) {
                io.to(roomID).emit("userDisconnected", "Other user has disconnected");
                console.log(`[Disconnect] User ${socket.id} left room ${roomID}`);
                // Clean up the room mappings
                for (const [userId, userRoomId] of mapOfUsersToRoomID.entries()) {
                    if (userRoomId === roomID) {
                        mapOfUsersToRoomID.delete(userId);
                    }
                }
            }
        } catch (error) {
            console.error("[Error] In handling disconnect:", error);
        }
    });

    

});

app.get("/", (req: Request, res: Response) => {
    res.send("Hello World");
});

httpServer.listen(3000);

// Helper function for handling insufficient users
function handleInsufficientUsers(socket: Socket, users: Socket[]) {
    socket.emit("notEnoughUsers", `Only ${queue.length} users online`);
    users.forEach(user => {
        if (user.connected) queue.push(user);
    });
}