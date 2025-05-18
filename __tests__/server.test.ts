// MAKE SURE THAT SERVER IS RUNNING ON LOCALHOST:3000 TO RUN THESE TESTS


import io from 'socket.io-client'
import request from 'supertest';



let socket_one: ReturnType<typeof io> | null = null;
let socket_two: ReturnType<typeof io> | null = null;

beforeAll( async () : Promise<boolean> => {
    // let's first connect socket here
    return new Promise(( resolve , reject ) => {

        socket_one = io("http://localhost:3000");

        const timeout = setTimeout(() => {
            reject(new Error("Socket connection timed out"));
        }, 5000); 

        socket_one.on("connect", () => {
            clearTimeout( timeout );
            resolve( true );
        });

        socket_one.on("connect_error", ( error : Error ) => {
            clearTimeout( timeout );
            reject( error );
        });

    })
})

afterAll(() => {
    socket_one?.disconnect();
    socket_two?.disconnect();
  });
  

  it('should respond to GET / with Hello World', async () => {
    const res = await request('http://localhost:3000').get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello World');
  });


// TEST : Connecting to Random User 

test("Connecting to random user should return notEnoughUsers if only one user is online",(done)=>{

    socket_one?.on("notEnoughUsers",( message : string ) : void => {
        expect(message).toMatch(/Only/);
        done();
    })
    socket_one?.on("error",( error : Error ) => {
        done(error);
    })


    socket_one?.emit("connectToRandomUser");

})  


function connectSocketTwo() : Promise< ReturnType<typeof io> > {
    return new Promise( ( resolve , reject ) => {
        const newSocket = io("http://localhost:3000");
        newSocket.on("connect",()=>{
            resolve(newSocket);
        })
        newSocket.on("connect_error",( error : Error ) => {
            reject(error);
        })    
    })
}


describe("Socket Matching Test Suite", () => {
    beforeAll(async () => {
        socket_two = await connectSocketTwo();
    });

    test("Two users should be matched and emit matchFound and youAreInitiator", (done) => {

        let matchFoundCount: number = 0;
        let user1Initiator: boolean | null = null;
        let user2Initiator: boolean | null = null;

        socket_two?.on("matchFound", (message: string) => {
            try {
                expect(message).toBe("You are matched with another user");
                matchFoundCount++;
                checkDone();
            } catch (error) {
                done(error);
            }
        });

        socket_one?.on("matchFound", (message: string) => {
            try {
                expect(message).toBe("You are matched with another user");
                matchFoundCount++;
                checkDone();
            } catch (error) {
                done(error);
            }
        });

        socket_one?.on("youAreInitiator", (val: boolean) => {
            try {
                expect(val).toBe(true);
                user1Initiator = val;
                checkDone();
            } catch (error) {
                done(error);
            }
        });

        socket_two?.on("youAreInitiator", (val: boolean) => {
            try {
                expect(val).toBe(false);
                user2Initiator = val;
                checkDone();
            } catch (error) {
                done(error);
            }
        });

        socket_one?.on("error", (error: Error) => done(error));
        socket_two?.on("error", (error: Error) => done(error));

        socket_two?.emit("connectToRandomUser");


        function checkDone(): void {
            if (
                matchFoundCount === 2 &&
                user1Initiator === true &&
                user2Initiator === false
            ) {
                done();
            }
        }

    });

    // test messaging and WEBRTC service with two users

    test("Messages should work", (done) => {
        let checkCount: number = 0;
    
        function checkDone(): void {
            if (checkCount === 2) {
                done();
            }
        }
    
        socket_two?.on("messageFromUser", (message: string) => {
            try {
                expect(message).toBe("Hello from socket_one");
                checkCount++;
                checkDone();
            } catch (error) {
                done(error);
            }
        });
    
        socket_one?.on("messageFromUser", (message: string) => {
            try {
                expect(message).toBe("Hello from socket_two");
                checkCount++;
                checkDone();
            } catch (error) {
                done(error);
            }
        });
    
        socket_one?.emit("messageFromUser", "Hello from socket_one");
        socket_two?.emit("messageFromUser", "Hello from socket_two");
    });

    // TEST : Sending Offer

    test("Offer should work", (done) => {
        const fakeOffer = {
            sdp: "fake sdp",
            type: "offer"
        }   

        socket_two?.on("offer", (offer: any) => {
            try {
                expect(offer).toEqual(fakeOffer);
                done();
            } catch (err) {
                done(err);
            }
        })
        socket_one?.on("error", (error: Error) => done(error));
        socket_two?.on("error", (error: Error) => done(error));

        socket_one?.emit("offer", fakeOffer);  
    })
    // TEST : Sending Answer

    test("Answer should work", (done) => {
        const fakeAnswer = {
            sdp: "fake sdp",
            type: "answer"
        }

        socket_two?.on("answer", (answer: any) => {
            try {
                expect(answer).toEqual(fakeAnswer);
                done();
            } catch (err) {
                done(err);
            }
        })

        socket_one?.emit("answer", fakeAnswer);
    })

    // TEST : Sending ICE Candidate

    test("ICE Candidate should work", (done) => {
        const fakeCandidate = {
            candidate: "fake candidate",
            sdpMLineIndex: 0,
            sdpMid: "fake mid"
        }
        let checkCount : number = 0 ; 

        function checkDone() : void {
            if( checkCount==2 ){
                done();
            }
        }

        socket_one?.on("ice_candidate", (candidate: any) => {
            try {
                expect(candidate).toEqual(fakeCandidate);
                checkCount++;
                checkDone();
            } catch (err) {
                done(err);
            }
        })

        socket_two?.on("ice_candidate", (candidate: any) => {
            try {
                expect(candidate).toEqual(fakeCandidate);
                checkCount++;
                checkDone();    
            } catch (err) {
                done(err);
            }
        })

        socket_one?.emit("ice_candidate", fakeCandidate);
        socket_two?.emit("ice_candidate", fakeCandidate);
    })

    // TEST : Local Stream Set

    test("Local Stream Set should work", (done) => {
        let checkCount : number = 0 ; 
        function checkDone() : void {
            if( checkCount==2 ){
                done();
            }
        }

        socket_one?.on("localStreamSet", () => {
            checkCount++;
            checkDone();
        })

        socket_two?.on("localStreamSet", () => {
            checkCount++;
            checkDone();
        })

        socket_one?.emit("localStreamSet");
        socket_two?.emit("localStreamSet");
    })

});

// TEST : Next Event

test("Next Event should re-queue the user or emit notEnoughUsers", (done) => {
    socket_one?.on("notEnoughUsers", (message : string) => {
        expect(message).toMatch(/Only/);
        done();
    });
    socket_one?.emit("next");
});

