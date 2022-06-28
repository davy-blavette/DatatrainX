<script>
    import {fly} from 'svelte/transition';
    import {faqStore} from "../../stores";
    let modalFaq;

    faqStore.subscribe(value => {
        modalFaq = value;
    });


</script>
<style>
    .modal .notification{
        color: black;
    }
</style>
<div class="modal {modalFaq ? 'is-active' : ''}" in:fly="{{ y: 200, duration: 1000 }}">
    <div class="modal-background" on:click ={() => faqStore.set(false)}></div>
    <div class="modal-content">
        <div class="notification">
            <strong>Le loading est toujours en cours (entre 1 et 2 minutes) :</strong>
            <p>Le chargement du modele de reconnaissance du visage fait 5mo, le chargement peut être long. Patientez encore un peu.</p>
            <strong>Le loading est vraiment trés trés long (plus de 2 minutes) :</strong>
            <p>Il est possible que votre webcam ne se lance pas, vérifier les paramètres navigateurs, pour débloquer l'accés.</p>
            <strong>La vidéo clignote, il y'a des difficultés à reconnaitre mon visage :</strong>
            <p>Si vous êtes devant une fenêtre, il est possible qu'il y'ait trop de luminosité, essayer de changer de place ou fermer les rideaux.</p>
            <strong>Il ne reconnait pas mes émotions :</strong>
            <p>Ne soyez pas masqué, évitez de trop bouger ou encore ne soyez pas trop loin de votre caméra.</p>
        </div>
    </div>
</div>