<script>
    import {fly } from 'svelte/transition';
    import {layoutStore} from "../../../stores";
    import * as animateScroll from "svelte-scrollto";
    export let open = false;

    let layoutValue;
    layoutStore.subscribe(value => {
        layoutValue = value;
    });


</script>
<style>

</style>
{#key open}
<div class="dropdown is-right {open ? 'is-active' : ''}"  in:fly="{{ y: 200, duration: 1000 }}">
    <div class="dropdown-menu" id="dropdown-menu" role="menu">
        <div class="dropdown-content">
            <a href="{'#'}" class="dropdown-item {layoutValue == 'presentation' ? 'is-active' : ''}" on:click ={() => layoutStore.setLayout("presentation")} on:click ={() => open = false}>
                Présentation
            </a>
            <a href="{'#'}" class="dropdown-item" on:click={() => animateScroll.scrollTo({element: "#article"})}  on:click ={() => open = false}>
                Article
            </a>
            <a href="{'#'}" class="dropdown-item {layoutValue == 'resultatKolb' ? 'is-active' : ''}" on:click ={() => layoutStore.setLayout("resultatKolb")} on:click ={() => open = false}>
                Exemple de résutats
            </a>
            <a href="{'#'}" class="dropdown-item {layoutValue == 'cnn' ? 'is-active' : ''}" on:click ={() => layoutStore.setLayout("cnn")} on:click ={() => open = false}>
                Réseau CNN
            </a>
            <a href="{'#'}" class="dropdown-item {layoutValue == 'opendata' ? 'is-active' : ''}" on:click ={() => layoutStore.setLayout("opendata")} on:click ={() => open = false}>
                OpenData
            </a>
            <hr class="dropdown-divider">
            <a href="{'#'}" class="dropdown-item {layoutValue == 'start' ? 'is-active' : ''}" on:click ={() => layoutStore.setLayout("start")} on:click ={() => open = false}>
                Faire le test
            </a>
        </div>
    </div>
</div>
{/key}
