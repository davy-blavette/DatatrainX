<script>
    export let isOpen = false;
    import { slide } from 'svelte/transition';
    const handleClick = () => isOpen = !isOpen
</script>

<style>
    button {
        width: 100%;
        border: none;
        background: none;
        display:block;
        color: inherit;
        font-size: 36px;
        cursor: pointer;
    }

    svg {
        transition: transform 0.2s ease-in;
        float: left;
        width: 50px;
        height: 35px;
    }

    [aria-expanded=true] svg { transform: rotate(0.25turn); }
    div.header {
        display:flex;
        width:100%;
    }

    div.header .text {
        flex: 1;
        margin-right: 5px;
    }

</style>
    <div class="header">
        <div class="text">
            <button on:click={handleClick} aria-expanded={isOpen}><svg width="20" height="20" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5l7 7-7 7"></path></svg>
                <slot name="head"></slot>
            </button>
        </div>
    </div>

    {#if isOpen}
        <div class="details" transition:slide>
            <slot name="details">
            </slot>
        </div>
    {/if}