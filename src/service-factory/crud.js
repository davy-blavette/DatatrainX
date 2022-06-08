import {baseUrl} from "./data";
import {userIdtStore, userTokenStore} from "../stores";


let userId;
let token;

userIdtStore.subscribe(value => {
    userId = value;
});
userTokenStore.subscribe(value => {
    token = value;
});

export let updatePush = async (type, data) => {

    let method = "PUT";

    if(userId){
        URL = `${baseUrl}/${type}/${userId}`;

        const res = await fetch(URL, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization":`Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

    }
};

export let getTrainer = async () => {
    let method = "GET";

    if(userId){
        URL = `${baseUrl}/dataProfil/${userId}`;
        const res = await fetch(URL, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization":`Bearer ${token}`
            }
        });
        await res.json();
    }
};

export let getDemo = async (type, data) => {

    const res = await fetch(baseUrl);
    await res.json();

};