<script>
    import {fly } from 'svelte/transition';
    import {layoutTrainxStore, loadingStore, userIdtStore, videoStore, layoutStore} from "../../stores";
    import {baseUrl, userToken} from "../../service-factory/data";

    let method;
    let playVideo;
    let loading;
    let userId;
    let openModal = false;
    let oldUserId = "";

    userIdtStore.subscribe(value => {
        userId = value;
    });
    videoStore.subscribe(value => {
        playVideo = value;
    });
    loadingStore.subscribe(value => {
        loading = value;
    });
    //save Token
    let addToken = async () => {

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
    if(!userId){
        addToken();
    }

</script>

<style>
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
        <p>David Kolb a publié le modèle des styles d’apprentissage dans lequel il a développé l’inventaire des styles d’apprentissage en 1984.<br>La théorie de l’apprentissage expérientiel de Kolb fonctionne à deux niveaux : un cycle d’apprentissage en quatre étapes et quatre styles d’apprentissage distincts. Une grande partie de la théorie de Kolb a à voir avec les processus cognitifs internes de l’étudiant.</p>
        <p>Ce questionnaire est conçu pour découvrir vos styles d'apprentissage préférés en tant qu'adulte. Ce questionnaire vous prendra probablement environ 10 minutes à remplir. La précision de vos résultats dépend de votre honnêteté.</p>
        <p>Lisez chaque ligne et cochez l’option appropriée. Allez avec votre première réponse instinctive plutôt que de trop réfléchir à votre réponse.</p>
        <div class="container m-1">
            <div class="field">
                <div class="label">Votre token est :</div>
                <p class="center-content control has-icons-left">
                    <input class="input is-danger is-rounded" type="text" disabled value="{userId}" placeholder="Veuillez saisir votre token">
                    <span class="icon is-small is-left">
                      <i class="fas fa-lock"></i>
                    </span>
                </p>
                <a href="{'#'}" on:click ={() => openModal = true} class="help">Sasir un token</a>
                {#key openModal}
                <div class="modal {openModal ? 'is-active' : ''}" in:fly="{{ y: 200, duration: 1000 }}">
                    <div class="modal-background" on:click ={() => openModal = false}></div>
                    <div class="modal-content">
                        <div class="notification">
                            <button class="delete" on:click ={() => openModal = false}></button>
                            <input class="m-1 input is-danger is-rounded" type="text"  bind:value={oldUserId} placeholder="Veuillez saisir votre token">
                            <button class="m-1 button are-medium center is-success is-rounded" on:click ={userIdtStore.set(oldUserId)} on:click ={() => layoutStore.setLayout("resultatKolb")}>
                                <span class="icon">
                                    <i class="fa-solid fa-check"></i>
                                </span>
                                <span>Voir les résultats</span>
                            </button>
                        </div>
                    </div>
                    <button class="modal-close is-large" aria-label="close"></button>
                </div>
                {/key}
                <div class="container m-1">

                {#if loading || playVideo == false}
                    <button class="button are-medium center is-warning is-loading is-rounded">Détection émotion...</button>
                    <p class="help">Vérifier que votre webcam est active...</p>
                {:else}
                    <button class="button are-medium center is-link is-rounded" on:click ={() => layoutTrainxStore.setLayout("kolb")}>
                        <span class="icon">
                            <i class="fa-solid fa-fingerprint"></i>
                        </span>
                        <span>Je suis prêt!</span>
                    </button>
                {/if}
                </div>
            </div>
        </div>
    </article>
</div>
