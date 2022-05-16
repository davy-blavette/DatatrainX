<script>
    import {fly } from 'svelte/transition';
    import {kolbStore} from "../../stores";
    import {questions} from "../../kolb";
    import {baseUrl, userToken} from "../../data";


    let checked = null;
    let question;

    function reset() {
        checked = null;
    }

    kolbStore.subscribe(value => {
        question = value;
    });


    let method;
    let data = {
        _id: userToken
    };
    let addToken = async () => {

        URL = `${baseUrl}`;
        method = "POST";

        const res = await fetch(URL, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const post = res.json();
        dispatch("postCreated", post);

    };

</script>
<style>
.buttons{
    margin-top: 2em;
}
.field{
    text-align: left;
}
</style>

<div class="tile is-parent">
    {#key question}
    <article class="tile is-child notification is-info" in:fly="{{ y: 200, duration: 1000 }}">
        <p class="title">Question {question + 1} / {questions.length}</p>
        <p class="subtitle">{questions[question][0]} :</p>
        <div class="container">
            <div class="field">
                <label class="b-radio radio">
                    <input type="radio" checked={checked==="A"} name="group_1" value="A" bind:group={checked}>
                    <span class="check is-success"></span>
                    <span class="control-label">{questions[question][1]}</span>
                </label>
            </div>

            <div class="field">
                <label class="b-radio radio">
                    <input type="radio" checked={checked==="B"}  name="group_1" value="B" bind:group={checked}>
                    <span class="check is-success"></span>
                    <span class="control-label">{questions[question][2]}</span>
                </label>
            </div>
        </div>
        <div class="buttons are-medium">
            <button class="button are-medium center is-success is-rounded" disabled={!checked} on:click={reset} on:click ={() => kolbStore.update(n => n + 1)}>
                <span class="icon">
                    <i class="fa-solid fa-check"></i>
                </span>
                <span>Valider</span>
            </button>
        </div>
    </article>
    {/key}
</div>