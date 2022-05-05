<script>
    import {layoutStore} from "../stores";
</script>

<style>

    #header {
        height: 50px;
        display: flex;
        padding: 0 20px;
        align-items: center;
        background: #3273dc;
        justify-content: space-between;
        position: fixed;
        width: 100%;
        z-index: 99;
        top: 0px;
    }

    #logo {
        display: flex;
        align-items: center;
        cursor: pointer;
    }

    #header i{
        color: white;
        font-size: 1.5em;
    }

</style>


<header id="header">

    <div id="logo">
        <div id="logo-text" on:click ={() => layoutStore.setLayout("presentation")}>
            DataTrainX
        </div>
        <div id="svg-logo-tagline" class="is-hidden-mobile">
            Outil de recherche des singularités cognitives d’un étudiant!
        </div>
    </div>

    <div class="icons">
        <div class="icon" title="Open-source code">
            <a target="_blank" href="https://github.com/davy-blavette/DatatrainX">
                <i class="fa-brands fa-github"></i>
            </a>
        </div>

    </div>

</header>