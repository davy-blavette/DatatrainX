<script>
    import {fly } from 'svelte/transition';
    import {kolbStore, userIdtStore, layoutStore, videoStore, loadingStore, dataExpressionStore} from "../../stores";
    import {questions} from "../../service-factory/kolb2";
    import {updatePush} from "../../service-factory/crud";
    import {dataProfil} from "../../service-factory/data";

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

        layoutStore.setLayout("calculs");
    }
    let update = async (type, data) => {
        let typeProfil = questions[question].type;
        await updatePush('dataCondition', {
            ref: question,
            dataProfil: {
                [typeProfil]: parseInt(checked)
            },
            created: Date.now()
        });
        dataProfil.apprenant.dim1[typeProfil].scoreRacine += parseInt(checked);

        await updatePush('dataProfil', {
            apprenant: dataProfil.apprenant,
            created: Date.now()
        });

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
                    <button class="button are-medium center is-success is-rounded"
                            disabled={!checked}
                            on:click={update}
                            on:click ={() => kolbStore.update(n => n + 1)}>
                    <span class="icon">
                        <i class="fa-solid fa-check"></i>
                    </span>
                        <span>Valider</span>
                    </button>
                </div>
            {/if}
        {:else}
            {layoutStore.setLayout("calculs")}
        {/if}
    </article>
    {/key}
</div>