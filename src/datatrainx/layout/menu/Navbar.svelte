<script>
    import Hamburger from './Hamburger.svelte'
    export let sidebar = false
</script>


<nav class="flex">
    <Hamburger bind:open={sidebar}/>
</nav>
