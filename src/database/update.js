import {baseUrl, userToken, FaceExpression} from "./data";
import {userIdtStore, videoStore} from "../stores";

let method = "PUT";
let userId;

userIdtStore.subscribe(value => {
    userId = value;
});
export let updatePush = async (type, data) => {

    if(userId){
        URL = `${baseUrl}/${type}/${userId}`;

        const res = await fetch(URL, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const trainer = res.json();
    }
};