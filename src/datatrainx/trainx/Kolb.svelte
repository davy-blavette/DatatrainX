<script>
    import {fly } from 'svelte/transition';
    import {kolbStore, userIdtStore, layoutStore} from "../../stores";
    import {questions} from "../../kolb";
    import {baseUrl, dataExpression, kolbReponse} from "../../data";

    let method = "PUT";
    let userId;

    let updateKolb = async () => {

        kolbReponse.push(checked);
        URL = `${baseUrl}/kolb/${userId}`;

        let data = {
            kolb:{
                dataExpression:{
                    colere:dataExpression.colere,
                    degout:dataExpression.degout,
                    peur:dataExpression.peur,
                    joie:dataExpression.joie,
                    triste:dataExpression.triste,
                    surprise:dataExpression.surprise,
                    neutre:dataExpression.neutre
                },
                reponse:kolbReponse
            }
        };

        const res = await fetch(URL, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const trainer = res.json();

    };


    let checked = null;
    let question;

    function reset() {
        updateKolb();
        checked = null;
    }

    kolbStore.subscribe(value => {
        question = value;
    });

    userIdtStore.subscribe(value => {
        userId = value;
    });

</script>
<style>
.buttons{
    margin-top: 2em;
}
.field{
    text-align: left;
}
</style>

<div class="">
    {#key question}
    <article class="tile is-child is-info" in:fly="{{ y: 200, duration: 1000 }}">
        {#if question + 1 < questions.length}
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
        {:else}
            <button class="button are-medium center is-success is-rounded" on:click ={() => layoutStore.setLayout("resultatKolb")}>
                    <span class="icon">
                        <i class="fa-solid fa-check"></i>
                    </span>
                <span>Voir les résultats</span>
            </button>
        {/if}
    </article>
    {/key}
</div>