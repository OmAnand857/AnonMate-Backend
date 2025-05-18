export interface RTCOfferData {
    sdp: string;
    type: 'offer';
}

export interface RTCAnswerData {
    sdp: string;
    type: 'answer';
}

export interface RTCIceCandidateData {
    candidate: string;
    sdpMLineIndex: number;
    sdpMid: string;
}
