<script>
    import { createEventDispatcher } from "svelte";
    import {baseUrl} from "../data";
    const dispatch = createEventDispatcher();

    export let editPost;
    let loading = false;
    let data = {
        title: "",
        category: "",
        author: "",
        content: ""
    };

    let URL, method;

    $: data = editPost;


    let addNewPost = async () => {
        if (
            data.title.trim() === "" ||
            data.category.trim() === "" ||
            data.author.trim() === "" ||
            data.content.trim() === ""
        ) {
            return;
        }
        loading = true;
        if (editPost._id) {
            URL = `${baseUrl}/${editPost._id}`;
            method = "PUT";
            console.log("update", editPost);
        } else {
            URL = `${baseUrl}`;
            method = "POST";
            console.log("post", editPost);
        }
        const res = await fetch(URL, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const post = res.json();
        dispatch("postCreated", post);
        data = {
            title: "",
            category: "",
            author: "",
            content: ""
        };
        loading = false;
    };
</script>

<section class="mt-4">
    <div class="container">
        <div class="row">
            <div class="col-md-5">
                <div class="card p-3">
                    {#if !loading}
                        <form on:submit|preventDefault={addNewPost}>
                            <div class="form-group">
                                <label for="title">Title</label>
                                <input
                                        bind:value={editPost.title}
                                        type="text"
                                        class="form-control"
                                        id="title"
                                        placeholder="Title" />
                            </div>

                            <div class="form-group">
                                <label for="category">Category</label>
                                <input
                                        bind:value={editPost.category}
                                        type="text"
                                        class="form-control"
                                        id="category"
                                        placeholder="Category" />
                            </div>
                            <div class="form-group">
                                <label for="author">Author</label>
                                <input
                                        bind:value={editPost.author}
                                        type="text"
                                        class="form-control"
                                        id="author"
                                        placeholder="Author" />
                            </div>

                            <div class="form-group">
                                <label for="content">Content</label>
                                <textarea
                                        bind:value={editPost.content}
                                        class="form-control"
                                        id="content"
                                        rows="3"
                                        placeholder="Content" />
                            </div>

                            <button type="submit" class="btn btn-primary">
                                {editPost._id ? 'Update' : 'Submit'}
                            </button>
                        </form>
                    {:else}
                        <p>Loading ...</p>
                    {/if}
                </div>

            </div>
        </div>
    </div>
</section>
