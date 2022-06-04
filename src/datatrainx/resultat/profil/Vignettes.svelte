<script>
    import Vignette from "./Vignette.svelte";
    export let joie;
    export let surprise;
    export let peur;
    export let degout;
    export let triste;
    export let colere;
    export let neutre;



</script>
<style>
    figure, img {
        height: 150px;
    }
</style>

<div class="tile is-parent">
    {#if colere.image}
        <Vignette
                image="{colere.image}"
                best="{colere.best}"
                intensity="{Math.round(colere.total / colere.count * 100)}"
                bg="has-background-danger"
                label="Colère"
        />
    {/if}
    {#if degout.image}
        <Vignette
                image="{degout.image}"
                best="{degout.best}"
                intensity="{Math.round(degout.total / degout.count * 100)}"
                bg="has-background-warning"
                label="Dégoût"
        />
    {/if}
    {#if peur.image}
        <Vignette
                image="{peur.image}"
                best="{peur.best}"
                intensity="{Math.round(peur.total / peur.count * 100)}"
                bg="has-background-success"
                label="Peur"
        />
    {/if}
    {#if joie.image}
        <Vignette
                image="{joie.image}"
                best="{joie.best}"
                intensity="{Math.round(joie.total / joie.count * 100)}"
                bg="has-background-info"
                label="Joie"
        />
    {/if}
    {#if triste.image}
        <Vignette
                image="{triste.image}"
                best="{triste.best}"
                intensity="{Math.round(triste.total / triste.count * 100)}"
                bg="has-background-triste"
                label="Triste"
        />
    {/if}
    {#if surprise.image}
        <Vignette
                image="{surprise.image}"
                best="{surprise.best}"
                intensity="{Math.round(surprise.total / surprise.count * 100)}"
                bg="has-background-surprise"
                label="Surprise"
        />
    {/if}
</div>



