<script>
    import {layoutStore} from "../../stores";
    import Faceapi from "../Faceapi.svelte";
</script>
<style>
    h2{
        text-align: center;
        font-size: 1.5em;
        font-weight: bold;
        margin-bottom: 8px;
    }
</style>
<section class="hero is-link is-fullheight-with-navbar">
    <div class="hero-body container">
        <div class="columns center is-vcentered">
            <div class="column">
                <p>A travers la saisie d’un questionnaire (Kolb) nous cherchons à déterminer un profil d’apprenant dans le projet DataTrainx.<br>
                    L’utilisateur sera enregistré en vidéo et une comparaison sera effectuée avec les émotions que vous aurez exprimées.</p>
                <div class="buttons are-medium">
                    <button class="button are-medium center is-link is-rounded" on:click ={() => layoutStore.setLayout("trainx2")}>
                    <span class="icon">
                        <i class="fa-solid fa-fingerprint"></i>
                    </span>
                        <span>Je suis prêt!</span>
                    </button>
                </div>
            </div>
            <div class="column">
                <Faceapi/>
            </div>
        </div>

    </div>
</section>

