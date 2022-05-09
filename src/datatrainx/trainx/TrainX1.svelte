<script>
    import {layoutStore} from "../../stores";
    import {userToken} from "../../config";
    import Faceapi from "../Faceapi.svelte";
    import ChartStream from "./ChartStream.svelte";




</script>
<style>
    h2{
        text-align: center;
        font-size: 1.5em;
        font-weight: bold;
        margin-bottom: 8px;
    }
    .center-content{
        width: 60%;
        margin: 0 auto;
    }

    input{
        text-align: center
    }
</style>
<section class="hero is-link is-fullheight-with-navbar">
    <div class="hero-body container">
        <div class="columns center is-vcentered is-multiline">
            <div class="column is-half">
                <p>A travers la saisie d’un questionnaire (Kolb) nous cherchons à déterminer un profil d’apprenant dans le projet DataTrainx.<br>
                    L’utilisateur sera enregistré en vidéo et une comparaison sera effectuée avec les émotions que vous aurez exprimées.</p>
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
                <div class="buttons are-medium">
                    <button class="button are-medium center is-link is-rounded" on:click ={() => layoutStore.setLayout("trainx2")}>
                    <span class="icon">
                        <i class="fa-solid fa-fingerprint"></i>
                    </span>
                        <span>Je suis prêt!</span>
                    </button>
                </div>
            </div>
            <div class="column is-half">
                <Faceapi/>
            </div>
            <div class="column">
                <ChartStream/>
            </div>
        </div>
    </div>
</section>

