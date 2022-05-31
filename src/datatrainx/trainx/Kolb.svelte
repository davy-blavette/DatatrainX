<script>
    import {fly } from 'svelte/transition';
    import {kolbStore, userIdtStore, layoutStore, videoStore, loadingStore, dataExpressionStore} from "../../stores";
    import {questions} from "../../database/kolb2";
    import {updatePush} from "../../database/update";
    import {dataProfil} from "../../database/data";

    let userId;
    let playVideo;
    let loading;
    let dataExpression;

    videoStore.subscribe(value => {
        playVideo = value;
    });
    loadingStore.subscribe(value => {
        loading = value;
    });

    let checked = null;
    let question;

    function updateProfil() {
        updatePush('dataProfil', {
                activist:dataProfil.activist,
                reflector:dataProfil.reflector,
                theorist:dataProfil.theorist,
                pragmatist:dataProfil.pragmatist,
                created:Date.now()
        });
    }

    function update() {

        let type = questions[question].type;
        updatePush('dataCondition', {
            ref:question,
            dataProfil:{
                [type]:parseInt(checked)
            },
            created:Date.now()
            });
        dataProfil[type] += parseInt(checked);
        checked = null;
        console.log(dataProfil);
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
        {#if question + 1 <= questions.length}
            <p class="title">Question {question + 1} / {questions.length}</p>
            <p class="subtitle">{questions[question].question} :</p>
            <div class="container">
                <div class="field">
                    <label class="b-radio radio">
                        <input type="radio" checked={checked==="1"} name="group_1" value="1" bind:group={checked}>
                        <span class="check is-success"></span>
                        <span class="control-label">Je suis d’accord</span>
                    </label>
                </div>

                <div class="field">
                    <label class="b-radio radio">
                        <input type="radio" checked={checked==="0"}  name="group_1" value="0" bind:group={checked}>
                        <span class="check is-success"></span>
                        <span class="control-label">Je ne suis pas d’accord</span>
                    </label>
                </div>
            </div>
            {#if loading || playVideo == false}
                <button class="button are-medium center is-warning is-loading is-rounded">Détection émotion...</button>
                <p class="help">Vérifier que votre webcam est active...</p>
            {:else}
                <div class="buttons are-medium">
                    <button class="button are-medium center is-success is-rounded" disabled={!checked} on:click={update} on:click ={() => kolbStore.update(n => n + 1)}>
                    <span class="icon">
                        <i class="fa-solid fa-check"></i>
                    </span>
                        <span>Valider</span>
                    </button>
                </div>
            {/if}
        {:else}
            <button class="button are-medium center is-success is-rounded" on:click ={() => updateProfil()} on:click ={() => layoutStore.setLayout("resultatKolb")}>
                    <span class="icon">
                        <i class="fa-solid fa-check"></i>
                    </span>
                <span>Voir les résultats</span>
            </button>
        {/if}
    </article>
    {/key}
</div>