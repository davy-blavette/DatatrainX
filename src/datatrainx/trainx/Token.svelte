<script>
    import {layoutTrainxStore, userIdtStore, videoStore} from "../../stores";
    import {baseUrl, dataExpression, kolbReponse, userToken} from "../../data";

    let method;
    let playVideo;

    videoStore.subscribe(value => {
        playVideo = value;
    });
    //save Token
    let addToken = async () => {
        //Data Reset
        /*
        kolbReponse.length = 0;
        dataExpression.colere.length = 0;
        dataExpression.degout.length = 0;
        dataExpression.peur.length = 0;
        dataExpression.joie.length = 0;
        dataExpression.triste.length = 0;
        dataExpression.surprise.length = 0;
        dataExpression.neutre.length = 0;
        */
        let data = {token: userToken};
        URL = `${baseUrl}`;
        method = "POST";

        const res = await fetch(URL, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const trainer = res.json();
        trainer.then(function(result) {
            userIdtStore.set(result.data._id);
        });
    };
    addToken();

</script>

<style>
    h2{
        text-align: center;
        font-size: 1.5em;
        font-weight: bold;
        margin-bottom: 8px;
    }
    .center-content{
        max-width: 300px;
        margin: 0 auto;
    }
    .label {
        color: white;
    }
    input{
        text-align: center
    }
    .m-1{
        margin: 1em;
    }
</style>

<div class="tile">
    <article class="tile is-child is-info">
        <p class="title">Votre profil d'apprenant</p>
        <p class="">A travers la saisie d’un questionnaire (Kolb) nous cherchons à déterminer un profil d’apprenant dans le projet DataTrainx.<br>L’utilisateur sera enregistré en vidéo et une comparaison sera effectuée avec les émotions que vous aurez exprimées.</p>
        <div class="container m-1">
            <div class="field">
                <label class="label">Votre token est :</label>
                <p class="center-content control has-icons-left">
                    <input class="input is-danger is-rounded" type="text" disabled value="{userToken}" placeholder="Veuillez saisir votre token">
                    <span class="icon is-small is-left">
                      <i class="fas fa-lock"></i>
                    </span>
                </p>
                <p class="help">Sasir un token</p>
            </div>
        </div>

        <div class="buttons are-medium">
            {#if !playVideo}
                <button class="button are-medium center is-warning is-loading  is-rounded">Détection émotion...</button>
            {:else}
            <button class="button are-medium center is-link is-rounded" on:click ={() => layoutTrainxStore.setLayout("kolb")}>
                <span class="icon">
                    <i class="fa-solid fa-fingerprint"></i>
                </span>
                <span>Je suis prêt!</span>
            </button>
            {/if}
        </div>
    </article>
</div>
