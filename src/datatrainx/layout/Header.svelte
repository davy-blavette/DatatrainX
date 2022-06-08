<script>
    import {layoutStore, userIdtStore} from "../../stores";
    import Sidebar from "./menu/Sidebar.svelte";
    import Navbar from "./menu/Navbar.svelte";
    import Logo from "./Logo.svelte";

    export let open = false;

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
            <Logo color={"ffffff"} />
        </div>
        <div id="svg-logo-tagline" class="is-hidden-mobile">
            Outil de recherche des singularités cognitives d’un apprenant!
        </div>
    </div>

    <div class="icons">
        <Sidebar bind:open/>
        <Navbar bind:sidebar={open}/>
        <div class="icon" title="Open-source code">
            <a target="_blank" href="https://github.com/davy-blavette/DatatrainX">
                <i class="fa-brands fa-github"></i>
            </a>
        </div>

    </div>

</header>