var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.47.0' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const cnnStore = writable([]);
    const svgStore = writable(undefined);

    const vSpaceAroundGapStore = writable(undefined);
    const hSpaceAroundGapStore = writable(undefined);

    const nodeCoordinateStore = writable([]);
    const selectedScaleLevelStore = writable(undefined);

    const cnnLayerRangesStore = writable({});
    const cnnLayerMinMaxStore = writable([]);

    const needRedrawStore = writable([undefined, undefined]);

    const detailedModeStore = writable(true);

    const shouldIntermediateAnimateStore = writable(false);

    const isInSoftmaxStore = writable(false);
    const softmaxDetailViewStore = writable({});
    const allowsSoftmaxAnimationStore = writable(false);

    const hoverInfoStore = writable({});

    const modalStore = writable({});

    const intermediateLayerPositionStore = writable({});

    const leftStartStore = writable(0);

    // Enum of node types

    // Helper functions

    /**
     * Create a 2D array (matrix) with given size and default value.
     * 
     * @param {int} height Height (number of rows) for the matrix
     * @param {int} width Width (number of columns) for the matrix
     * @param {int} fill Default value to fill this matrix
     */
    const init2DArray = (height, width, fill) => {
      let array = [];
      // Itereate through rows
      for (let r = 0; r < height; r++) {
        let row = new Array(width).fill(fill);
        array.push(row);
      }
      return array;
    };

    /**
     * Dot product of two matrices.
     * @param {[[number]]} mat1 Matrix 1
     * @param {[[number]]} mat2 Matrix 2
     */
    const matrixDot = (mat1, mat2) => {
      console.assert(mat1.length === mat2.length, 'Dimension not matching');
      console.assert(mat1[0].length === mat2[0].length, 'Dimension not matching');

      let result = 0;
      for (let i = 0; i < mat1.length; i++){
        for (let j = 0; j < mat1[0].length; j++){
          result += mat1[i][j] * mat2[i][j];
        }
      }
      
      return result;
    };

    /**
     * 2D slice on a matrix.
     * @param {[[number]]} mat Matrix
     * @param {int} xs First dimension (row) starting index
     * @param {int} xe First dimension (row) ending index
     * @param {int} ys Second dimension (column) starting index
     * @param {int} ye Second dimension (column) ending index
     */
    const matrixSlice = (mat, xs, xe, ys, ye) => {
      return mat.slice(xs, xe).map(s => s.slice(ys, ye));
    };

    /**
     * Compute the maximum of a matrix.
     * @param {[[number]]} mat Matrix
     */
    const matrixMax = (mat) => {
      let curMax = -Infinity;
      for (let i = 0; i < mat.length; i++) {
        for (let j = 0; j < mat[0].length; j++) {
          if (mat[i][j] > curMax) {
            curMax = mat[i][j];
          }
        }
      }
      return curMax;
    };

    /**
     * Compute convolutions of one kernel on one matrix (one slice of a tensor).
     * @param {[[number]]} input Input, square matrix
     * @param {[[number]]} kernel Kernel weights, square matrix
     * @param {int} stride Stride size
     * @param {int} padding Padding size
     */
    const singleConv = (input, kernel, stride=1, padding=0) => {
      // TODO: implement padding

      // Only support square input and kernel
      console.assert(input.length === input[0].length,
         'Conv input is not square');
      console.assert(kernel.length === kernel[0].length,
        'Conv kernel is not square');

      let stepSize = (input.length - kernel.length) / stride + 1;

      let result = init2DArray(stepSize, stepSize, 0);

      // Window sliding
      for (let r = 0; r < stepSize; r++) {
        for (let c = 0; c < stepSize; c++) {
          let curWindow = matrixSlice(input, r * stride, r * stride + kernel.length,
            c * stride, c * stride + kernel.length);
          let dot = matrixDot(curWindow, kernel);
          result[r][c] = dot;
        }
      }
      return result;
    };

    /**
     * Max pool one matrix.
     * @param {[[number]]} mat Matrix
     * @param {int} kernelWidth Pooling kernel length (only supports 2)
     * @param {int} stride Pooling sliding stride (only supports 2)
     * @param {string} padding Pading method when encountering odd number mat,
     * currently this function only supports 'VALID'
     */
    const singleMaxPooling = (mat, kernelWidth=2, stride=2, padding='VALID') => {
      console.assert(kernelWidth === 2, 'Only supports kernen = [2,2]');
      console.assert(stride === 2, 'Only supports stride = 2');
      console.assert(padding === 'VALID', 'Only support valid padding');

      // Handle odd length mat
      // 'VALID': ignore edge rows and columns
      // 'SAME': add zero padding to make the mat have even length
      if (mat.length % 2 === 1 && padding === 'VALID') {
        mat = matrixSlice(mat, 0, mat.length - 1, 0, mat.length - 1);
      }

      let stepSize = (mat.length - kernelWidth) / stride + 1;
      let result = init2DArray(stepSize, stepSize, 0);

      for (let r = 0; r < stepSize; r++) {
        for (let c = 0; c < stepSize; c++) {
          let curWindow = matrixSlice(mat, r * stride, r * stride + kernelWidth,
            c * stride, c * stride + kernelWidth);
          result[r][c] = matrixMax(curWindow);
        }
     }
     return result;
    };

    function array1d(length, f) {
      return Array.from({length: length}, f ? ((v, i) => f(i)) : undefined);
    }

    function array2d(height, width, f) {
      return Array.from({length: height}, (v, i) => Array.from({length: width}, f ? ((w, j) => f(i, j)) : undefined));
    }

    function generateOutputMappings(stride, output, kernelLength, padded_input_size, dilation) {
      const outputMapping = array2d(output.length, output.length, (i, j) => array2d(kernelLength, kernelLength));
      for (let h_out = 0; h_out < output.length; h_out++) {
        for (let w_out = 0; w_out < output.length; w_out++) {
          for (let h_kern = 0; h_kern < kernelLength; h_kern++) {
            for (let w_kern = 0; w_kern < kernelLength; w_kern++) {
              const h_im = h_out * stride + h_kern * dilation;
              const w_im = w_out * stride + w_kern * dilation;
              outputMapping[h_out][w_out][h_kern][w_kern] = h_im * padded_input_size + w_im;
            }
          }
        }
      }
      return outputMapping;
    }

    function compute_input_multiplies_with_weight(hoverH, hoverW, 
                                                  padded_input_size, weight_dims, outputMappings, kernelLength) {
      const input_multiplies_with_weight = array1d(padded_input_size * padded_input_size);
      for (let h_weight = 0; h_weight < kernelLength; h_weight++) {
        for (let w_weight = 0; w_weight < kernelLength; w_weight++) {
          const flat_input = outputMappings[hoverH][hoverW][h_weight][w_weight];
          if (typeof flat_input === "undefined") continue;
          input_multiplies_with_weight[flat_input] = [h_weight, w_weight];
        }
      }
      return input_multiplies_with_weight;
    }

    function getMatrixSliceFromInputHighlights(matrix, highlights, kernelLength) {
      var indices = highlights.reduce((total, value, index) => {
      if (value != undefined) total.push(index);
        return total;
      }, []);
      return matrixSlice(matrix, Math.floor(indices[0] / matrix.length), Math.floor(indices[0] / matrix.length) + kernelLength, indices[0] % matrix.length, indices[0] % matrix.length + kernelLength);
    }

    function getMatrixSliceFromOutputHighlights(matrix, highlights) {
      var indices = highlights.reduce((total, value, index) => {
      if (value != false) total.push(index);
        return total;
      }, []);
      return matrixSlice(matrix, Math.floor(indices[0] / matrix.length), Math.floor(indices[0] / matrix.length) + 1, indices[0] % matrix.length, indices[0] % matrix.length + 1);
    }

    // Edit these values to change size of low-level conv visualization.
    function getVisualizationSizeConstraint(imageLength) {
      let sizeOfGrid = 150;
      let maxSizeOfGridCell = 20;
      return sizeOfGrid / imageLength > maxSizeOfGridCell ? maxSizeOfGridCell : sizeOfGrid / imageLength;
    }

    function getDataRange(image) {
      let maxRow = image.map(function(row){ return Math.max.apply(Math, row); });
      let max = Math.max.apply(null, maxRow);
      let minRow = image.map(function(row){ return Math.min.apply(Math, row); });
      let min = Math.min.apply(null, minRow);
      let range = {
        range: 2 * Math.max(Math.abs(min), Math.abs(max)),
        min: min,
        max: max
      };
      return range;
    }

    function gridData(image, constraint=getVisualizationSizeConstraint(image.length)) {
      // Constrain grids based on input image size.
      var data = new Array();
      var xpos = 1;
      var ypos = 1;
      var width = constraint;
      var height = constraint;
      for (var row = 0; row < image.length; row++) {
        data.push( new Array() );
        for (var column = 0; column < image[0].length; column++) {
          data[row].push({
            text: Math.round(image[row][column] * 100) / 100,
            row: row,
            col: column,
            x: xpos,
            y: ypos,
            width: width,
            height: height
          });
          xpos += width;
        }
        xpos = 1;
        ypos += height; 
      }
      return data;
    }

    /* src\detail-view\Dataview.svelte generated by Svelte v3.47.0 */
    const file = "src\\detail-view\\Dataview.svelte";

    function create_fragment(ctx) {
    	let div;
    	let svg;

    	const block = {
    		c: function create() {
    			div = element("div");
    			svg = svg_element("svg");
    			attr_dev(svg, "id", "grid");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			add_location(svg, file, 120, 2, 3869);
    			set_style(div, "display", "inline-block");
    			set_style(div, "vertical-align", "middle");
    			attr_dev(div, "class", "grid");
    			add_location(div, file, 118, 0, 3768);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, svg);
    			/*div_binding*/ ctx[10](div);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[10](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const textConstraintDivisor = 2.6;
    const standardCellColor = "ddd";

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Dataview', slots, []);
    	let { data } = $$props;
    	let { highlights } = $$props;
    	let { isKernelMath } = $$props;
    	let { constraint } = $$props;
    	let { dataRange } = $$props;
    	let { outputLength = undefined } = $$props;
    	let { stride = undefined } = $$props;
    	let { colorScale = d3.interpolateRdBu } = $$props;
    	let { isInputLayer = false } = $$props;
    	let grid_final;
    	const dispatch = createEventDispatcher();
    	let oldHighlight = highlights;
    	let oldData = data;

    	const redraw = () => {
    		d3.select(grid_final).selectAll("#grid > *").remove();
    		const constrainedSvgSize = data.length * constraint + 2;
    		var grid = d3.select(grid_final).select("#grid").attr("width", constrainedSvgSize + "px").attr("height", constrainedSvgSize + "px").append("svg").attr("width", constrainedSvgSize + "px").attr("height", constrainedSvgSize + "px");
    		var row = grid.selectAll(".row").data(data).enter().append("g").attr("class", "row");

    		var column = row.selectAll(".square").data(function (d) {
    			return d;
    		}).enter().append("rect").attr("class", "square").attr("x", function (d) {
    			return d.x;
    		}).attr("y", function (d) {
    			return d.y;
    		}).attr("width", function (d) {
    			return d.width;
    		}).attr("height", function (d) {
    			return d.height;
    		}).style("opacity", 0.8).style("fill", function (d) {
    			let normalizedValue = d.text;

    			if (isInputLayer) {
    				normalizedValue = 1 - d.text;
    			} else {
    				normalizedValue = (d.text + dataRange / 2) / dataRange;
    			}

    			return colorScale(normalizedValue);
    		}).on('mouseover', function (d) {
    			if (data.length != outputLength) {
    				dispatch('message', {
    					hoverH: Math.min(Math.floor(d.row / stride), outputLength - 1),
    					hoverW: Math.min(Math.floor(d.col / stride), outputLength - 1)
    				});
    			} else {
    				dispatch('message', {
    					hoverH: Math.min(Math.floor(d.row / 1), outputLength - 1),
    					hoverW: Math.min(Math.floor(d.col / 1), outputLength - 1)
    				});
    			}
    		});

    		if (isKernelMath) {
    			var text = row.selectAll(".text").data(function (d) {
    				return d;
    			}).enter().append("text").attr("class", "text").style("font-size", Math.floor(constraint / textConstraintDivisor) + "px").attr("x", function (d) {
    				return d.x + d.width / 2;
    			}).attr("y", function (d) {
    				return d.y + d.height / 2;
    			}).style("fill", function (d) {
    				let normalizedValue = d.text;

    				if (isInputLayer) {
    					normalizedValue = 1 - d.text;
    				} else {
    					normalizedValue = (d.text + dataRange / 2) / dataRange;
    				}

    				if (normalizedValue < 0.2 || normalizedValue > 0.8) {
    					return 'white';
    				} else {
    					return 'black';
    				}
    			}).style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    				return d.text.toString().replace('-', '－');
    			});
    		}
    	};

    	afterUpdate(() => {
    		if (data != oldData) {
    			redraw();
    			oldData = data;
    		}

    		if (highlights != oldHighlight) {
    			var grid = d3.select(grid_final).select('#grid').select("svg");

    			grid.selectAll(".square").style("stroke", d => isKernelMath || highlights.length && highlights[d.row * data.length + d.col]
    			? "black"
    			: null);

    			oldHighlight = highlights;
    		}
    	});

    	onMount(() => {
    		redraw();
    	});

    	const writable_props = [
    		'data',
    		'highlights',
    		'isKernelMath',
    		'constraint',
    		'dataRange',
    		'outputLength',
    		'stride',
    		'colorScale',
    		'isInputLayer'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Dataview> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			grid_final = $$value;
    			$$invalidate(0, grid_final);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('highlights' in $$props) $$invalidate(2, highlights = $$props.highlights);
    		if ('isKernelMath' in $$props) $$invalidate(3, isKernelMath = $$props.isKernelMath);
    		if ('constraint' in $$props) $$invalidate(4, constraint = $$props.constraint);
    		if ('dataRange' in $$props) $$invalidate(5, dataRange = $$props.dataRange);
    		if ('outputLength' in $$props) $$invalidate(6, outputLength = $$props.outputLength);
    		if ('stride' in $$props) $$invalidate(7, stride = $$props.stride);
    		if ('colorScale' in $$props) $$invalidate(8, colorScale = $$props.colorScale);
    		if ('isInputLayer' in $$props) $$invalidate(9, isInputLayer = $$props.isInputLayer);
    	};

    	$$self.$capture_state = () => ({
    		data,
    		highlights,
    		isKernelMath,
    		constraint,
    		dataRange,
    		outputLength,
    		stride,
    		colorScale,
    		isInputLayer,
    		onMount,
    		onDestroy,
    		beforeUpdate,
    		afterUpdate,
    		createEventDispatcher,
    		grid_final,
    		textConstraintDivisor,
    		standardCellColor,
    		dispatch,
    		oldHighlight,
    		oldData,
    		redraw
    	});

    	$$self.$inject_state = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('highlights' in $$props) $$invalidate(2, highlights = $$props.highlights);
    		if ('isKernelMath' in $$props) $$invalidate(3, isKernelMath = $$props.isKernelMath);
    		if ('constraint' in $$props) $$invalidate(4, constraint = $$props.constraint);
    		if ('dataRange' in $$props) $$invalidate(5, dataRange = $$props.dataRange);
    		if ('outputLength' in $$props) $$invalidate(6, outputLength = $$props.outputLength);
    		if ('stride' in $$props) $$invalidate(7, stride = $$props.stride);
    		if ('colorScale' in $$props) $$invalidate(8, colorScale = $$props.colorScale);
    		if ('isInputLayer' in $$props) $$invalidate(9, isInputLayer = $$props.isInputLayer);
    		if ('grid_final' in $$props) $$invalidate(0, grid_final = $$props.grid_final);
    		if ('oldHighlight' in $$props) oldHighlight = $$props.oldHighlight;
    		if ('oldData' in $$props) oldData = $$props.oldData;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		grid_final,
    		data,
    		highlights,
    		isKernelMath,
    		constraint,
    		dataRange,
    		outputLength,
    		stride,
    		colorScale,
    		isInputLayer,
    		div_binding
    	];
    }

    class Dataview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			data: 1,
    			highlights: 2,
    			isKernelMath: 3,
    			constraint: 4,
    			dataRange: 5,
    			outputLength: 6,
    			stride: 7,
    			colorScale: 8,
    			isInputLayer: 9
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dataview",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<Dataview> was created without expected prop 'data'");
    		}

    		if (/*highlights*/ ctx[2] === undefined && !('highlights' in props)) {
    			console.warn("<Dataview> was created without expected prop 'highlights'");
    		}

    		if (/*isKernelMath*/ ctx[3] === undefined && !('isKernelMath' in props)) {
    			console.warn("<Dataview> was created without expected prop 'isKernelMath'");
    		}

    		if (/*constraint*/ ctx[4] === undefined && !('constraint' in props)) {
    			console.warn("<Dataview> was created without expected prop 'constraint'");
    		}

    		if (/*dataRange*/ ctx[5] === undefined && !('dataRange' in props)) {
    			console.warn("<Dataview> was created without expected prop 'dataRange'");
    		}
    	}

    	get data() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get highlights() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set highlights(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isKernelMath() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isKernelMath(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get constraint() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set constraint(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get outputLength() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set outputLength(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get stride() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set stride(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorScale() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorScale(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isInputLayer() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isInputLayer(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\KernelMathView.svelte generated by Svelte v3.47.0 */
    const file$1 = "src\\detail-view\\KernelMathView.svelte";

    function create_fragment$1(ctx) {
    	let div0;
    	let t;
    	let div1;
    	let svg_1;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t = space();
    			div1 = element("div");
    			svg_1 = svg_element("svg");
    			attr_dev(div0, "class", "legend");
    			add_location(div0, file$1, 282, 0, 10542);
    			attr_dev(svg_1, "id", "grid");
    			attr_dev(svg_1, "width", "100%");
    			attr_dev(svg_1, "height", "100%");
    			add_location(svg_1, file$1, 289, 2, 10700);
    			attr_dev(div1, "class", "grid");
    			add_location(div1, file$1, 287, 0, 10655);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			/*div0_binding*/ ctx[10](div0);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, svg_1);
    			/*div1_binding*/ ctx[11](div1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			/*div0_binding*/ ctx[10](null);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div1);
    			/*div1_binding*/ ctx[11](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const textConstraintDivisor$1 = 2.6;

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('KernelMathView', slots, []);
    	let { data } = $$props;
    	let { kernel } = $$props;
    	let { constraint } = $$props;
    	let { dataRange } = $$props;
    	let { kernelRange } = $$props;
    	let { colorScale = d3.interpolateRdBu } = $$props;
    	let { kernelColorScale = d3.interpolateBrBG } = $$props;
    	let { isInputLayer = false } = $$props;
    	let gridFinal;
    	let legendFinal;
    	const multiplicationSymbolPadding = Math.floor(constraint / 3);
    	let oldData = data;
    	let oldKernel = kernel;

    	// Legend drawn similarly to legends in overview/intermediate-view.
    	const addOverlayGradient = (gradientID, stops, group) => {
    		if (group === undefined) {
    			group = svg;
    		}

    		// Create a gradient
    		let defs = group.append("defs").attr('class', 'overlay-gradient');

    		let gradient = defs.append("linearGradient").attr("id", gradientID).attr("x1", "0%").attr("x2", "100%").attr("y1", "100%").attr("y2", "100%");

    		stops.forEach(s => {
    			gradient.append('stop').attr('offset', s.offset).attr('stop-color', s.color).attr('stop-opacity', s.opacity);
    		});
    	};

    	// Draw the legend for intermediate layer
    	const redrawDetailedConvViewLegend = arg => {
    		let legendHeight = arg.legendHeight,
    			range = arg.range,
    			minMax = arg.minMax,
    			width = arg.width,
    			colorScale = arg.colorScale,
    			gradientGap = arg.gradientGap;

    		d3.select(legendFinal).selectAll("#legend > *").remove();
    		let legend = d3.select(legendFinal).select("#legend").attr("width", 150 + "px").attr("height", 25 + "px").attr("align", "center").style("dominant-baseline", "middle");
    		let detailedViewKernel = legend.append('g').attr('transform', `translate(10, 0)`);

    		if (colorScale === undefined) {
    			colorScale = layerColorScales.conv;
    		}

    		if (gradientGap === undefined) {
    			gradientGap = 0;
    		}

    		// Add a legend color gradient
    		let gradientName = `url(#detailed-kernel-gradient)`;

    		let normalizedColor = v => colorScale(v * (1 - 2 * gradientGap) + gradientGap);

    		let leftValue = (minMax.min + range / 2) / range,
    			zeroValue = (0 + range / 2) / range,
    			rightValue = (minMax.max + range / 2) / range,
    			totalRange = minMax.max - minMax.min,
    			zeroLocation = (0 - minMax.min) / totalRange,
    			leftMidValue = leftValue + (zeroValue - leftValue) / 2,
    			rightMidValue = zeroValue + (rightValue - zeroValue) / 2;

    		let stops = [
    			{
    				offset: 0,
    				color: normalizedColor(leftValue),
    				opacity: 1
    			},
    			{
    				offset: zeroLocation / 2,
    				color: normalizedColor(leftMidValue),
    				opacity: 1
    			},
    			{
    				offset: zeroLocation,
    				color: normalizedColor(zeroValue),
    				opacity: 1
    			},
    			{
    				offset: zeroLocation + (1 - zeroValue) / 2,
    				color: normalizedColor(rightMidValue),
    				opacity: 1
    			},
    			{
    				offset: 1,
    				color: normalizedColor(rightValue),
    				opacity: 1
    			}
    		];

    		addOverlayGradient(`detailed-kernel-gradient`, stops, detailedViewKernel);
    		let legendScale = d3.scaleLinear().range([0, width - 1.2]).domain([minMax.min, minMax.max]);
    		let legendAxis = d3.axisBottom().scale(legendScale).tickFormat(d3.format('.2f')).tickValues([minMax.min, 0, minMax.max]);
    		let detailedLegend = detailedViewKernel.append('g').attr('id', `detailed-legend-0`);
    		let legendGroup = detailedLegend.append('g').attr('transform', `translate(0, ${legendHeight - 3})`).call(legendAxis);
    		legendGroup.selectAll('text').style('font-size', '9px').style('fill', "black");
    		legendGroup.selectAll('path, line').style('stroke', "black");
    		detailedLegend.append('rect').attr('width', width).attr('height', legendHeight).style('fill', gradientName);
    	};

    	// Draw the elementwise dot-product math.
    	const redraw = () => {
    		d3.select(gridFinal).selectAll("#grid > *").remove();

    		const constrainedSvgSize = kernel
    		? 2 * (data.length * constraint) + 2
    		: data.length * constraint + 2;

    		var grid = d3.select(gridFinal).select("#grid").attr("width", constrainedSvgSize + "px").attr("height", constrainedSvgSize + "px").append("svg").attr("width", constrainedSvgSize + "px").attr("height", constrainedSvgSize + "px");
    		var row = grid.selectAll(".row").data(data).enter().append("g").attr("class", "row");

    		var columns = row.selectAll(".square").data(function (d) {
    			return d;
    		}).enter();

    		// Draw cells for slice from input matrix.
    		columns.append("rect").attr("class", "square").attr("x", function (d) {
    			return d.x === 1
    			? d.x + multiplicationSymbolPadding
    			: d.x * 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1 ? d.y : d.y * 2;
    		}).attr("width", function (d) {
    			return d.width;
    		}).attr("height", function (d) {
    			return d.height;
    		}).style("opacity", 0.5).style("fill", function (d) {
    			let normalizedValue = d.text;

    			if (isInputLayer) {
    				normalizedValue = 1 - d.text;
    			} else {
    				normalizedValue = (d.text + dataRange / 2) / dataRange;
    			}

    			return colorScale(normalizedValue);
    		}).style("stroke", "black");

    		// Draw cells for the kernel.
    		columns.append("rect").attr("class", "square").attr("x", function (d) {
    			return d.x === 1
    			? d.x + multiplicationSymbolPadding
    			: d.x * 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1 ? d.y + d.height : d.y * 2 + d.height;
    		}).attr("width", function (d) {
    			return d.width;
    		}).attr("height", function (d) {
    			return d.height / 2;
    		}).style("opacity", 0.5).// Same colorscale as is used for the flatten layers.
    		style("fill", function (d) {
    			let normalizedValue = (kernel[d.row][d.col].text + kernelRange.range / 2) / kernelRange.range;
    			const gap = 0.2;
    			let normalizedValueWithGap = normalizedValue * (1 - 2 * gap) + gap;
    			return kernelColorScale(normalizedValueWithGap);
    		});

    		var texts = row.selectAll(".text").data(function (d) {
    			return d;
    		}).enter();

    		// Draw numbers from input matrix slice.
    		texts.append("text").attr("class", "text").style("font-size", Math.floor(constraint / textConstraintDivisor$1) + "px").attr("x", function (d) {
    			return d.x === 1
    			? d.x + d.width / 2 + multiplicationSymbolPadding
    			: d.x * 2 + d.width / 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1 ? d.y + d.height / 2 : d.y * 2 + d.height / 2;
    		}).style("fill", function (d) {
    			let normalizedValue = d.text;

    			if (isInputLayer) {
    				normalizedValue = 1 - d.text;
    			} else {
    				normalizedValue = (d.text + dataRange / 2) / dataRange;
    			}

    			if (normalizedValue < 0.2 || normalizedValue > 0.8) {
    				if (isInputLayer && normalizedValue < 0.2) {
    					return 'black';
    				}

    				return 'white';
    			} else {
    				return 'black';
    			}
    		}).style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    			return d.text;
    		});

    		// Attempted to use FontAwesome icons for the 'x', '+', and '=', but none of these strategies work: https://github.com/FortAwesome/Font-Awesome/issues/12268
    		// Draw 'x' to signify multiplication.
    		texts.append("text").attr("class", "text").style("font-size", Math.floor(constraint / textConstraintDivisor$1) + "px").attr('font-weight', 600).attr("x", function (d) {
    			return d.x === 1
    			? d.x + multiplicationSymbolPadding / 2
    			: d.x * 2 + multiplicationSymbolPadding / 2;
    		}).attr("y", function (d) {
    			return d.y === 1
    			? d.y + d.height + d.height / 4
    			: d.y * 2 + d.height + d.height / 4;
    		}).style("fill", "black").style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    			return '×';
    		});

    		// Draw kernel values.
    		texts.append("text").attr("class", "text").style("font-size", Math.floor(constraint / textConstraintDivisor$1) + "px").attr("x", function (d) {
    			return d.x === 1
    			? d.x + d.width / 2 + multiplicationSymbolPadding
    			: d.x * 2 + d.width / 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1
    			? d.y + d.height + d.height / 4
    			: d.y * 2 + d.height + d.height / 4;
    		}).style("fill", function (d) {
    			let normalizedValue = (kernel[d.row][d.col].text + kernelRange.range / 2) / kernelRange.range;
    			const gap = 0.2;
    			let normalizedValueWithGap = normalizedValue * (1 - 2 * gap) + gap;

    			if (normalizedValueWithGap < 0.2 || normalizedValueWithGap > 0.8) {
    				return 'white';
    			} else {
    				return 'black';
    			}
    		}).style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    			return kernel[d.row][d.col].text;
    		});

    		// Draw '+' to signify the summing of products except for the last kernel cell where '=' is drawn.
    		texts.append("text").attr("class", "text").style("font-size", Math.floor(constraint / (textConstraintDivisor$1 - 1)) + "px").attr("x", function (d) {
    			return d.x === 1
    			? d.x + d.width + d.width / 2 + multiplicationSymbolPadding
    			: d.x * 2 + d.width + d.width / 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1 ? d.y + d.height / 2 : d.y * 2 + d.height / 2;
    		}).style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    			return d.row == kernel.length - 1 && d.col == kernel.length - 1
    			? '='
    			: '+';
    		});
    	};

    	afterUpdate(() => {
    		if (data != oldData) {
    			redraw();
    			oldData = data;
    		}

    		if (kernel != oldKernel) {
    			/*
    redrawDetailedConvViewLegend({
        legendHeight: 5,
        range: kernelRange.range,
        minMax: {min: kernelRange.min, max: kernelRange.max},
        width: 130,
        colorScale: kernelColorScale,
        gradientGap: 0.35,
    });
    */
    			oldKernel = kernel;
    		}
    	});

    	onMount(() => {
    		redraw();
    	}); /*
    redrawDetailedConvViewLegend({
          legendHeight: 5,
          range: kernelRange.range,
          minMax: {min: kernelRange.min, max: kernelRange.max},
          width: 130,
          colorScale: kernelColorScale,
          gradientGap: 0.35,
    });
    */

    	const writable_props = [
    		'data',
    		'kernel',
    		'constraint',
    		'dataRange',
    		'kernelRange',
    		'colorScale',
    		'kernelColorScale',
    		'isInputLayer'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<KernelMathView> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			legendFinal = $$value;
    			$$invalidate(1, legendFinal);
    		});
    	}

    	function div1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			gridFinal = $$value;
    			$$invalidate(0, gridFinal);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(2, data = $$props.data);
    		if ('kernel' in $$props) $$invalidate(3, kernel = $$props.kernel);
    		if ('constraint' in $$props) $$invalidate(4, constraint = $$props.constraint);
    		if ('dataRange' in $$props) $$invalidate(5, dataRange = $$props.dataRange);
    		if ('kernelRange' in $$props) $$invalidate(6, kernelRange = $$props.kernelRange);
    		if ('colorScale' in $$props) $$invalidate(7, colorScale = $$props.colorScale);
    		if ('kernelColorScale' in $$props) $$invalidate(8, kernelColorScale = $$props.kernelColorScale);
    		if ('isInputLayer' in $$props) $$invalidate(9, isInputLayer = $$props.isInputLayer);
    	};

    	$$self.$capture_state = () => ({
    		data,
    		kernel,
    		constraint,
    		dataRange,
    		kernelRange,
    		colorScale,
    		kernelColorScale,
    		isInputLayer,
    		onMount,
    		afterUpdate,
    		gridFinal,
    		legendFinal,
    		textConstraintDivisor: textConstraintDivisor$1,
    		multiplicationSymbolPadding,
    		oldData,
    		oldKernel,
    		addOverlayGradient,
    		redrawDetailedConvViewLegend,
    		redraw
    	});

    	$$self.$inject_state = $$props => {
    		if ('data' in $$props) $$invalidate(2, data = $$props.data);
    		if ('kernel' in $$props) $$invalidate(3, kernel = $$props.kernel);
    		if ('constraint' in $$props) $$invalidate(4, constraint = $$props.constraint);
    		if ('dataRange' in $$props) $$invalidate(5, dataRange = $$props.dataRange);
    		if ('kernelRange' in $$props) $$invalidate(6, kernelRange = $$props.kernelRange);
    		if ('colorScale' in $$props) $$invalidate(7, colorScale = $$props.colorScale);
    		if ('kernelColorScale' in $$props) $$invalidate(8, kernelColorScale = $$props.kernelColorScale);
    		if ('isInputLayer' in $$props) $$invalidate(9, isInputLayer = $$props.isInputLayer);
    		if ('gridFinal' in $$props) $$invalidate(0, gridFinal = $$props.gridFinal);
    		if ('legendFinal' in $$props) $$invalidate(1, legendFinal = $$props.legendFinal);
    		if ('oldData' in $$props) oldData = $$props.oldData;
    		if ('oldKernel' in $$props) oldKernel = $$props.oldKernel;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		gridFinal,
    		legendFinal,
    		data,
    		kernel,
    		constraint,
    		dataRange,
    		kernelRange,
    		colorScale,
    		kernelColorScale,
    		isInputLayer,
    		div0_binding,
    		div1_binding
    	];
    }

    class KernelMathView extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			data: 2,
    			kernel: 3,
    			constraint: 4,
    			dataRange: 5,
    			kernelRange: 6,
    			colorScale: 7,
    			kernelColorScale: 8,
    			isInputLayer: 9
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "KernelMathView",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[2] === undefined && !('data' in props)) {
    			console.warn("<KernelMathView> was created without expected prop 'data'");
    		}

    		if (/*kernel*/ ctx[3] === undefined && !('kernel' in props)) {
    			console.warn("<KernelMathView> was created without expected prop 'kernel'");
    		}

    		if (/*constraint*/ ctx[4] === undefined && !('constraint' in props)) {
    			console.warn("<KernelMathView> was created without expected prop 'constraint'");
    		}

    		if (/*dataRange*/ ctx[5] === undefined && !('dataRange' in props)) {
    			console.warn("<KernelMathView> was created without expected prop 'dataRange'");
    		}

    		if (/*kernelRange*/ ctx[6] === undefined && !('kernelRange' in props)) {
    			console.warn("<KernelMathView> was created without expected prop 'kernelRange'");
    		}
    	}

    	get data() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernel() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernel(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get constraint() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set constraint(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernelRange() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernelRange(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorScale() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorScale(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernelColorScale() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernelColorScale(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isInputLayer() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isInputLayer(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\ConvolutionAnimator.svelte generated by Svelte v3.47.0 */
    const file$2 = "src\\detail-view\\ConvolutionAnimator.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1_value = /*image*/ ctx[2].length + "";
    	let t1;
    	let t2;
    	let t3_value = /*image*/ ctx[2][0].length + "";
    	let t3;
    	let t4;
    	let t5;
    	let dataview0;
    	let t6;
    	let div2;
    	let kernelmathview;
    	let t7;
    	let dataview1;
    	let t8;
    	let div4;
    	let div3;
    	let t9;
    	let t10_value = /*output*/ ctx[3].length + "";
    	let t10;
    	let t11;
    	let t12_value = /*output*/ ctx[3][0].length + "";
    	let t12;
    	let t13;
    	let t14;
    	let dataview2;
    	let current;

    	dataview0 = new Dataview({
    			props: {
    				data: /*testImage*/ ctx[11],
    				highlights: /*inputHighlights*/ ctx[7],
    				outputLength: /*output*/ ctx[3].length,
    				isKernelMath: false,
    				constraint: getVisualizationSizeConstraint(/*image*/ ctx[2].length),
    				dataRange: /*dataRange*/ ctx[4],
    				stride: /*stride*/ ctx[0],
    				colorScale: /*colorScale*/ ctx[5],
    				isInputLayer: /*isInputInputLayer*/ ctx[6]
    			},
    			$$inline: true
    		});

    	dataview0.$on("message", /*handleMouseover*/ ctx[14]);

    	kernelmathview = new KernelMathView({
    			props: {
    				data: /*testInputMatrixSlice*/ ctx[9],
    				kernel: /*testKernel*/ ctx[13],
    				constraint: getVisualizationSizeConstraint(/*kernel*/ ctx[1].length),
    				dataRange: /*dataRange*/ ctx[4],
    				kernelRange: getDataRange(/*kernel*/ ctx[1]),
    				colorScale: /*colorScale*/ ctx[5],
    				isInputLayer: /*isInputInputLayer*/ ctx[6]
    			},
    			$$inline: true
    		});

    	dataview1 = new Dataview({
    			props: {
    				data: /*testOutputMatrixSlice*/ ctx[10],
    				highlights: /*outputHighlights*/ ctx[8],
    				isKernelMath: true,
    				constraint: getVisualizationSizeConstraint(/*kernel*/ ctx[1].length),
    				dataRange: /*dataRange*/ ctx[4]
    			},
    			$$inline: true
    		});

    	dataview2 = new Dataview({
    			props: {
    				data: /*testOutput*/ ctx[12],
    				highlights: /*outputHighlights*/ ctx[8],
    				isKernelMath: false,
    				outputLength: /*output*/ ctx[3].length,
    				constraint: getVisualizationSizeConstraint(/*output*/ ctx[3].length),
    				dataRange: /*dataRange*/ ctx[4],
    				stride: /*stride*/ ctx[0]
    			},
    			$$inline: true
    		});

    	dataview2.$on("message", /*handleMouseover*/ ctx[14]);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Input (");
    			t1 = text(t1_value);
    			t2 = text(", ");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			create_component(dataview0.$$.fragment);
    			t6 = space();
    			div2 = element("div");
    			create_component(kernelmathview.$$.fragment);
    			t7 = space();
    			create_component(dataview1.$$.fragment);
    			t8 = space();
    			div4 = element("div");
    			div3 = element("div");
    			t9 = text("Output (");
    			t10 = text(t10_value);
    			t11 = text(", ");
    			t12 = text(t12_value);
    			t13 = text(")");
    			t14 = space();
    			create_component(dataview2.$$.fragment);
    			attr_dev(div0, "class", "header-text");
    			add_location(div0, file$2, 106, 2, 4018);
    			attr_dev(div1, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div1, file$2, 105, 0, 3977);
    			attr_dev(div2, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div2, file$2, 114, 0, 4416);
    			attr_dev(div3, "class", "header-text");
    			add_location(div3, file$2, 122, 2, 4961);
    			attr_dev(div4, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div4, file$2, 121, 0, 4920);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);
    			append_dev(div1, t5);
    			mount_component(dataview0, div1, null);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div2, anchor);
    			mount_component(kernelmathview, div2, null);
    			append_dev(div2, t7);
    			mount_component(dataview1, div2, null);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, t9);
    			append_dev(div3, t10);
    			append_dev(div3, t11);
    			append_dev(div3, t12);
    			append_dev(div3, t13);
    			append_dev(div4, t14);
    			mount_component(dataview2, div4, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*image*/ 4) && t1_value !== (t1_value = /*image*/ ctx[2].length + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*image*/ 4) && t3_value !== (t3_value = /*image*/ ctx[2][0].length + "")) set_data_dev(t3, t3_value);
    			const dataview0_changes = {};
    			if (dirty & /*testImage*/ 2048) dataview0_changes.data = /*testImage*/ ctx[11];
    			if (dirty & /*inputHighlights*/ 128) dataview0_changes.highlights = /*inputHighlights*/ ctx[7];
    			if (dirty & /*output*/ 8) dataview0_changes.outputLength = /*output*/ ctx[3].length;
    			if (dirty & /*image*/ 4) dataview0_changes.constraint = getVisualizationSizeConstraint(/*image*/ ctx[2].length);
    			if (dirty & /*dataRange*/ 16) dataview0_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*stride*/ 1) dataview0_changes.stride = /*stride*/ ctx[0];
    			if (dirty & /*colorScale*/ 32) dataview0_changes.colorScale = /*colorScale*/ ctx[5];
    			if (dirty & /*isInputInputLayer*/ 64) dataview0_changes.isInputLayer = /*isInputInputLayer*/ ctx[6];
    			dataview0.$set(dataview0_changes);
    			const kernelmathview_changes = {};
    			if (dirty & /*testInputMatrixSlice*/ 512) kernelmathview_changes.data = /*testInputMatrixSlice*/ ctx[9];
    			if (dirty & /*testKernel*/ 8192) kernelmathview_changes.kernel = /*testKernel*/ ctx[13];
    			if (dirty & /*kernel*/ 2) kernelmathview_changes.constraint = getVisualizationSizeConstraint(/*kernel*/ ctx[1].length);
    			if (dirty & /*dataRange*/ 16) kernelmathview_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*kernel*/ 2) kernelmathview_changes.kernelRange = getDataRange(/*kernel*/ ctx[1]);
    			if (dirty & /*colorScale*/ 32) kernelmathview_changes.colorScale = /*colorScale*/ ctx[5];
    			if (dirty & /*isInputInputLayer*/ 64) kernelmathview_changes.isInputLayer = /*isInputInputLayer*/ ctx[6];
    			kernelmathview.$set(kernelmathview_changes);
    			const dataview1_changes = {};
    			if (dirty & /*testOutputMatrixSlice*/ 1024) dataview1_changes.data = /*testOutputMatrixSlice*/ ctx[10];
    			if (dirty & /*outputHighlights*/ 256) dataview1_changes.highlights = /*outputHighlights*/ ctx[8];
    			if (dirty & /*kernel*/ 2) dataview1_changes.constraint = getVisualizationSizeConstraint(/*kernel*/ ctx[1].length);
    			if (dirty & /*dataRange*/ 16) dataview1_changes.dataRange = /*dataRange*/ ctx[4];
    			dataview1.$set(dataview1_changes);
    			if ((!current || dirty & /*output*/ 8) && t10_value !== (t10_value = /*output*/ ctx[3].length + "")) set_data_dev(t10, t10_value);
    			if ((!current || dirty & /*output*/ 8) && t12_value !== (t12_value = /*output*/ ctx[3][0].length + "")) set_data_dev(t12, t12_value);
    			const dataview2_changes = {};
    			if (dirty & /*testOutput*/ 4096) dataview2_changes.data = /*testOutput*/ ctx[12];
    			if (dirty & /*outputHighlights*/ 256) dataview2_changes.highlights = /*outputHighlights*/ ctx[8];
    			if (dirty & /*output*/ 8) dataview2_changes.outputLength = /*output*/ ctx[3].length;
    			if (dirty & /*output*/ 8) dataview2_changes.constraint = getVisualizationSizeConstraint(/*output*/ ctx[3].length);
    			if (dirty & /*dataRange*/ 16) dataview2_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*stride*/ 1) dataview2_changes.stride = /*stride*/ ctx[0];
    			dataview2.$set(dataview2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dataview0.$$.fragment, local);
    			transition_in(kernelmathview.$$.fragment, local);
    			transition_in(dataview1.$$.fragment, local);
    			transition_in(dataview2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dataview0.$$.fragment, local);
    			transition_out(kernelmathview.$$.fragment, local);
    			transition_out(dataview1.$$.fragment, local);
    			transition_out(dataview2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(dataview0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div2);
    			destroy_component(kernelmathview);
    			destroy_component(dataview1);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(div4);
    			destroy_component(dataview2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const padding = 0;

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ConvolutionAnimator', slots, []);
    	let { stride } = $$props;
    	let { dilation } = $$props;
    	let { kernel } = $$props;
    	let { image } = $$props;
    	let { output } = $$props;
    	let { isPaused } = $$props;
    	let { dataRange } = $$props;
    	let { colorScale } = $$props;
    	let { isInputInputLayer = false } = $$props;
    	const dispatch = createEventDispatcher();
    	let padded_input_size = image.length + padding * 2;

    	// Dummy data for original state of component.
    	let testInputMatrixSlice = [];

    	for (let i = 0; i < kernel.length; i++) {
    		testInputMatrixSlice.push([]);

    		for (let j = 0; j < kernel.length; j++) {
    			testInputMatrixSlice[i].push(0);
    		}
    	}

    	testInputMatrixSlice = gridData(testInputMatrixSlice);
    	let testOutputMatrixSlice = gridData([0]);
    	let inputHighlights = [];
    	let outputHighlights = array1d(output.length * output.length, i => true);
    	let interval;
    	let counter;

    	// lots of replication between mouseover and start-conv. TODO: fix this.
    	function startConvolution(stride) {
    		counter = 0;
    		let outputMappings = generateOutputMappings(stride, output, kernel.length, padded_input_size, dilation);
    		if (stride <= 0) return;
    		if (interval) clearInterval(interval);

    		$$invalidate(17, interval = setInterval(
    			() => {
    				if (isPaused) return;
    				const flat_animated = counter % (output.length * output.length);
    				$$invalidate(8, outputHighlights = array1d(output.length * output.length, i => false));
    				const animatedH = Math.floor(flat_animated / output.length);
    				const animatedW = flat_animated % output.length;
    				$$invalidate(8, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    				$$invalidate(7, inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernel.length, outputMappings, kernel.length));
    				const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernel.length);
    				$$invalidate(9, testInputMatrixSlice = gridData(inputMatrixSlice));
    				const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    				$$invalidate(10, testOutputMatrixSlice = gridData(outputMatrixSlice));
    				counter++;
    			},
    			250
    		));
    	}

    	function handleMouseover(event) {
    		let outputMappings = generateOutputMappings(stride, output, kernel.length, padded_input_size, dilation);
    		$$invalidate(8, outputHighlights = array1d(output.length * output.length, i => false));
    		const animatedH = event.detail.hoverH;
    		const animatedW = event.detail.hoverW;
    		$$invalidate(8, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    		$$invalidate(7, inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernel.length, outputMappings, kernel.length));
    		const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernel.length);
    		$$invalidate(9, testInputMatrixSlice = gridData(inputMatrixSlice));
    		const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    		$$invalidate(10, testOutputMatrixSlice = gridData(outputMatrixSlice));
    		$$invalidate(15, isPaused = true);
    		dispatch('message', { text: isPaused });
    	}

    	startConvolution(stride);
    	let testImage = gridData(image);
    	let testOutput = gridData(output);
    	let testKernel = gridData(kernel);

    	const writable_props = [
    		'stride',
    		'dilation',
    		'kernel',
    		'image',
    		'output',
    		'isPaused',
    		'dataRange',
    		'colorScale',
    		'isInputInputLayer'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ConvolutionAnimator> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('stride' in $$props) $$invalidate(0, stride = $$props.stride);
    		if ('dilation' in $$props) $$invalidate(16, dilation = $$props.dilation);
    		if ('kernel' in $$props) $$invalidate(1, kernel = $$props.kernel);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    		if ('output' in $$props) $$invalidate(3, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(15, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(4, dataRange = $$props.dataRange);
    		if ('colorScale' in $$props) $$invalidate(5, colorScale = $$props.colorScale);
    		if ('isInputInputLayer' in $$props) $$invalidate(6, isInputInputLayer = $$props.isInputInputLayer);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		array1d,
    		getMatrixSliceFromOutputHighlights,
    		compute_input_multiplies_with_weight,
    		getDataRange,
    		getVisualizationSizeConstraint,
    		generateOutputMappings,
    		getMatrixSliceFromInputHighlights,
    		gridData,
    		Dataview,
    		KernelMathView,
    		stride,
    		dilation,
    		kernel,
    		image,
    		output,
    		isPaused,
    		dataRange,
    		colorScale,
    		isInputInputLayer,
    		dispatch,
    		padding,
    		padded_input_size,
    		testInputMatrixSlice,
    		testOutputMatrixSlice,
    		inputHighlights,
    		outputHighlights,
    		interval,
    		counter,
    		startConvolution,
    		handleMouseover,
    		testImage,
    		testOutput,
    		testKernel
    	});

    	$$self.$inject_state = $$props => {
    		if ('stride' in $$props) $$invalidate(0, stride = $$props.stride);
    		if ('dilation' in $$props) $$invalidate(16, dilation = $$props.dilation);
    		if ('kernel' in $$props) $$invalidate(1, kernel = $$props.kernel);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    		if ('output' in $$props) $$invalidate(3, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(15, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(4, dataRange = $$props.dataRange);
    		if ('colorScale' in $$props) $$invalidate(5, colorScale = $$props.colorScale);
    		if ('isInputInputLayer' in $$props) $$invalidate(6, isInputInputLayer = $$props.isInputInputLayer);
    		if ('padded_input_size' in $$props) padded_input_size = $$props.padded_input_size;
    		if ('testInputMatrixSlice' in $$props) $$invalidate(9, testInputMatrixSlice = $$props.testInputMatrixSlice);
    		if ('testOutputMatrixSlice' in $$props) $$invalidate(10, testOutputMatrixSlice = $$props.testOutputMatrixSlice);
    		if ('inputHighlights' in $$props) $$invalidate(7, inputHighlights = $$props.inputHighlights);
    		if ('outputHighlights' in $$props) $$invalidate(8, outputHighlights = $$props.outputHighlights);
    		if ('interval' in $$props) $$invalidate(17, interval = $$props.interval);
    		if ('counter' in $$props) counter = $$props.counter;
    		if ('testImage' in $$props) $$invalidate(11, testImage = $$props.testImage);
    		if ('testOutput' in $$props) $$invalidate(12, testOutput = $$props.testOutput);
    		if ('testKernel' in $$props) $$invalidate(13, testKernel = $$props.testKernel);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*image*/ 4) {
    			 padded_input_size = image.length + padding * 2;
    		}

    		if ($$self.$$.dirty & /*output*/ 8) {
    			 {
    				let outputHighlights = array1d(output.length * output.length, i => true);
    			}
    		}

    		if ($$self.$$.dirty & /*stride, image, output, kernel*/ 15) {
    			 {
    				startConvolution(stride);
    				$$invalidate(11, testImage = gridData(image));
    				$$invalidate(12, testOutput = gridData(output));
    				$$invalidate(13, testKernel = gridData(kernel));
    			}
    		}
    	};

    	return [
    		stride,
    		kernel,
    		image,
    		output,
    		dataRange,
    		colorScale,
    		isInputInputLayer,
    		inputHighlights,
    		outputHighlights,
    		testInputMatrixSlice,
    		testOutputMatrixSlice,
    		testImage,
    		testOutput,
    		testKernel,
    		handleMouseover,
    		isPaused,
    		dilation,
    		interval
    	];
    }

    class ConvolutionAnimator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			stride: 0,
    			dilation: 16,
    			kernel: 1,
    			image: 2,
    			output: 3,
    			isPaused: 15,
    			dataRange: 4,
    			colorScale: 5,
    			isInputInputLayer: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ConvolutionAnimator",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*stride*/ ctx[0] === undefined && !('stride' in props)) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'stride'");
    		}

    		if (/*dilation*/ ctx[16] === undefined && !('dilation' in props)) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'dilation'");
    		}

    		if (/*kernel*/ ctx[1] === undefined && !('kernel' in props)) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'kernel'");
    		}

    		if (/*image*/ ctx[2] === undefined && !('image' in props)) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'image'");
    		}

    		if (/*output*/ ctx[3] === undefined && !('output' in props)) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'output'");
    		}

    		if (/*isPaused*/ ctx[15] === undefined && !('isPaused' in props)) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'isPaused'");
    		}

    		if (/*dataRange*/ ctx[4] === undefined && !('dataRange' in props)) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'dataRange'");
    		}

    		if (/*colorScale*/ ctx[5] === undefined && !('colorScale' in props)) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'colorScale'");
    		}
    	}

    	get stride() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set stride(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dilation() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dilation(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernel() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernel(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get image() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isPaused() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isPaused(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorScale() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorScale(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isInputInputLayer() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isInputInputLayer(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\Convolutionview.svelte generated by Svelte v3.47.0 */

    const { console: console_1 } = globals;
    const file$3 = "src\\detail-view\\Convolutionview.svelte";

    // (110:0) {#if !isExited}
    function create_if_block(ctx) {
    	let div10;
    	let div9;
    	let div5;
    	let div0;
    	let t1;
    	let div4;
    	let div1;
    	let i0;
    	let t2;
    	let div2;

    	let raw_value = (/*isPaused*/ ctx[6]
    	? '<i class="fas fa-play-circle play-icon"></i>'
    	: '<i class="fas fa-pause-circle"></i>') + "";

    	let t3;
    	let div3;
    	let i1;
    	let t4;
    	let div6;
    	let convolutionanimator;
    	let t5;
    	let div8;
    	let img;
    	let img_src_value;
    	let t6;
    	let div7;
    	let span;
    	let t8;
    	let current;
    	let mounted;
    	let dispose;

    	convolutionanimator = new ConvolutionAnimator({
    			props: {
    				kernel: /*kernel*/ ctx[2],
    				image: /*input*/ ctx[1],
    				output: /*outputFinal*/ ctx[7],
    				stride: /*stride*/ ctx[8],
    				dilation,
    				isPaused: /*isPaused*/ ctx[6],
    				dataRange: /*dataRange*/ ctx[3],
    				colorScale: /*colorScale*/ ctx[4],
    				isInputInputLayer: /*isInputInputLayer*/ ctx[5]
    			},
    			$$inline: true
    		});

    	convolutionanimator.$on("message", /*handlePauseFromInteraction*/ ctx[10]);

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = "Convolution";
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			i0 = element("i");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			i1 = element("i");
    			t4 = space();
    			div6 = element("div");
    			create_component(convolutionanimator.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			img = element("img");
    			t6 = space();
    			div7 = element("div");
    			span = element("span");
    			span.textContent = "Hover over";
    			t8 = text(" the matrices to change kernel position.");
    			attr_dev(div0, "class", "title-text svelte-1j8mhv0");
    			add_location(div0, file$3, 132, 8, 2833);
    			attr_dev(i0, "class", "fas fa-info-circle");
    			add_location(i0, file$3, 138, 12, 3033);
    			attr_dev(div1, "class", "control-button svelte-1j8mhv0");
    			attr_dev(div1, "title", "Jump to article section");
    			add_location(div1, file$3, 137, 10, 2936);
    			attr_dev(div2, "class", "play-button control-button svelte-1j8mhv0");
    			attr_dev(div2, "title", "Play animation");
    			add_location(div2, file$3, 141, 10, 3096);
    			attr_dev(i1, "class", "fas control-icon fa-times-circle");
    			add_location(i1, file$3, 148, 12, 3455);
    			attr_dev(div3, "class", "delete-button control-button svelte-1j8mhv0");
    			attr_dev(div3, "title", "Close");
    			add_location(div3, file$3, 147, 10, 3362);
    			attr_dev(div4, "class", "buttons svelte-1j8mhv0");
    			add_location(div4, file$3, 136, 8, 2904);
    			attr_dev(div5, "class", "control-pannel svelte-1j8mhv0");
    			add_location(div5, file$3, 130, 6, 2795);
    			attr_dev(div6, "class", "container is-centered svelte-1j8mhv0");
    			add_location(div6, file$3, 153, 6, 3556);
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/pointer.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pointer icon");
    			attr_dev(img, "class", "svelte-1j8mhv0");
    			add_location(img, file$3, 162, 8, 3950);
    			set_style(span, "font-weight", "600");
    			add_location(span, file$3, 164, 10, 4063);
    			attr_dev(div7, "class", "annotation-text");
    			add_location(div7, file$3, 163, 8, 4023);
    			attr_dev(div8, "class", "annotation svelte-1j8mhv0");
    			add_location(div8, file$3, 161, 6, 3917);
    			attr_dev(div9, "class", "box svelte-1j8mhv0");
    			add_location(div9, file$3, 128, 4, 2770);
    			attr_dev(div10, "class", "container svelte-1j8mhv0");
    			attr_dev(div10, "id", "detailview-container");
    			add_location(div10, file$3, 110, 2, 2186);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, i0);
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			div2.innerHTML = raw_value;
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, i1);
    			append_dev(div9, t4);
    			append_dev(div9, div6);
    			mount_component(convolutionanimator, div6, null);
    			append_dev(div9, t5);
    			append_dev(div9, div8);
    			append_dev(div8, img);
    			append_dev(div8, t6);
    			append_dev(div8, div7);
    			append_dev(div7, span);
    			append_dev(div7, t8);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", handleScroll, false, false, false),
    					listen_dev(div2, "click", /*handleClickPause*/ ctx[9], false, false, false),
    					listen_dev(div3, "click", /*handleClickX*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*isPaused*/ 64) && raw_value !== (raw_value = (/*isPaused*/ ctx[6]
    			? '<i class="fas fa-play-circle play-icon"></i>'
    			: '<i class="fas fa-pause-circle"></i>') + "")) div2.innerHTML = raw_value;
    			const convolutionanimator_changes = {};
    			if (dirty & /*kernel*/ 4) convolutionanimator_changes.kernel = /*kernel*/ ctx[2];
    			if (dirty & /*input*/ 2) convolutionanimator_changes.image = /*input*/ ctx[1];
    			if (dirty & /*outputFinal*/ 128) convolutionanimator_changes.output = /*outputFinal*/ ctx[7];
    			if (dirty & /*isPaused*/ 64) convolutionanimator_changes.isPaused = /*isPaused*/ ctx[6];
    			if (dirty & /*dataRange*/ 8) convolutionanimator_changes.dataRange = /*dataRange*/ ctx[3];
    			if (dirty & /*colorScale*/ 16) convolutionanimator_changes.colorScale = /*colorScale*/ ctx[4];
    			if (dirty & /*isInputInputLayer*/ 32) convolutionanimator_changes.isInputInputLayer = /*isInputInputLayer*/ ctx[5];
    			convolutionanimator.$set(convolutionanimator_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(convolutionanimator.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(convolutionanimator.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			destroy_component(convolutionanimator);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(110:0) {#if !isExited}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*isExited*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isExited*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isExited*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const dilation = 1;

    function handleScroll() {
    	let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    	let scroll = new SmoothScroll('a[href*="#"]', { offset: -svgHeight });
    	let anchor = document.querySelector(`#article-convolution`);
    	scroll.animateScroll(anchor);
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Convolutionview', slots, []);
    	let { input } = $$props;
    	let { kernel } = $$props;
    	let { dataRange } = $$props;
    	let { colorScale = d3.interpolateRdBu } = $$props;
    	let { isInputInputLayer = false } = $$props;
    	let { isExited = false } = $$props;

    	// export let output;
    	const dispatch = createEventDispatcher();

    	let stride = 1;
    	var isPaused = false;
    	var outputFinal = singleConv(input, kernel, stride);

    	function handleClickPause() {
    		$$invalidate(6, isPaused = !isPaused);
    	}

    	function handlePauseFromInteraction(event) {
    		$$invalidate(6, isPaused = event.detail.text);
    	}

    	function handleClickX() {
    		$$invalidate(0, isExited = true);
    		dispatch('message', { text: isExited });
    	}

    	const writable_props = ['input', 'kernel', 'dataRange', 'colorScale', 'isInputInputLayer', 'isExited'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Convolutionview> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('input' in $$props) $$invalidate(1, input = $$props.input);
    		if ('kernel' in $$props) $$invalidate(2, kernel = $$props.kernel);
    		if ('dataRange' in $$props) $$invalidate(3, dataRange = $$props.dataRange);
    		if ('colorScale' in $$props) $$invalidate(4, colorScale = $$props.colorScale);
    		if ('isInputInputLayer' in $$props) $$invalidate(5, isInputInputLayer = $$props.isInputInputLayer);
    		if ('isExited' in $$props) $$invalidate(0, isExited = $$props.isExited);
    	};

    	$$self.$capture_state = () => ({
    		ConvolutionAnimator,
    		singleConv,
    		createEventDispatcher,
    		input,
    		kernel,
    		dataRange,
    		colorScale,
    		isInputInputLayer,
    		isExited,
    		dispatch,
    		stride,
    		dilation,
    		isPaused,
    		outputFinal,
    		handleClickPause,
    		handleScroll,
    		handlePauseFromInteraction,
    		handleClickX
    	});

    	$$self.$inject_state = $$props => {
    		if ('input' in $$props) $$invalidate(1, input = $$props.input);
    		if ('kernel' in $$props) $$invalidate(2, kernel = $$props.kernel);
    		if ('dataRange' in $$props) $$invalidate(3, dataRange = $$props.dataRange);
    		if ('colorScale' in $$props) $$invalidate(4, colorScale = $$props.colorScale);
    		if ('isInputInputLayer' in $$props) $$invalidate(5, isInputInputLayer = $$props.isInputInputLayer);
    		if ('isExited' in $$props) $$invalidate(0, isExited = $$props.isExited);
    		if ('stride' in $$props) $$invalidate(8, stride = $$props.stride);
    		if ('isPaused' in $$props) $$invalidate(6, isPaused = $$props.isPaused);
    		if ('outputFinal' in $$props) $$invalidate(7, outputFinal = $$props.outputFinal);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*input, kernel*/ 6) {
    			 if (stride > 0) {
    				try {
    					$$invalidate(7, outputFinal = singleConv(input, kernel, stride));
    				} catch {
    					console.log("Cannot handle stride of " + stride);
    				}
    			}
    		}
    	};

    	return [
    		isExited,
    		input,
    		kernel,
    		dataRange,
    		colorScale,
    		isInputInputLayer,
    		isPaused,
    		outputFinal,
    		stride,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX
    	];
    }

    class Convolutionview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			input: 1,
    			kernel: 2,
    			dataRange: 3,
    			colorScale: 4,
    			isInputInputLayer: 5,
    			isExited: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Convolutionview",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*input*/ ctx[1] === undefined && !('input' in props)) {
    			console_1.warn("<Convolutionview> was created without expected prop 'input'");
    		}

    		if (/*kernel*/ ctx[2] === undefined && !('kernel' in props)) {
    			console_1.warn("<Convolutionview> was created without expected prop 'kernel'");
    		}

    		if (/*dataRange*/ ctx[3] === undefined && !('dataRange' in props)) {
    			console_1.warn("<Convolutionview> was created without expected prop 'dataRange'");
    		}
    	}

    	get input() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernel() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernel(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorScale() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorScale(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isInputInputLayer() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isInputInputLayer(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isExited() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isExited(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\ActivationAnimator.svelte generated by Svelte v3.47.0 */
    const file$4 = "src\\detail-view\\ActivationAnimator.svelte";

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1_value = /*image*/ ctx[0].length + "";
    	let t1;
    	let t2;
    	let t3_value = /*image*/ ctx[0][0].length + "";
    	let t3;
    	let t4;
    	let t5;
    	let dataview0;
    	let t6;
    	let div2;
    	let span;
    	let t7;
    	let dataview1;
    	let t8;
    	let dataview2;
    	let t9;
    	let dataview3;
    	let t10;
    	let div4;
    	let div3;
    	let t11;
    	let t12_value = /*output*/ ctx[1].length + "";
    	let t12;
    	let t13;
    	let t14_value = /*output*/ ctx[1][0].length + "";
    	let t14;
    	let t15;
    	let t16;
    	let dataview4;
    	let current;

    	dataview0 = new Dataview({
    			props: {
    				data: /*gridImage*/ ctx[7],
    				highlights: /*inputHighlights*/ ctx[3],
    				outputLength: /*output*/ ctx[1].length,
    				isKernelMath: false,
    				constraint: getVisualizationSizeConstraint(/*image*/ ctx[0].length),
    				dataRange: /*dataRange*/ ctx[2],
    				stride: 1
    			},
    			$$inline: true
    		});

    	dataview0.$on("message", /*handleMouseover*/ ctx[9]);

    	dataview1 = new Dataview({
    			props: {
    				data: gridData([[0]]),
    				highlights: /*outputHighlights*/ ctx[4],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	dataview2 = new Dataview({
    			props: {
    				data: /*gridInputMatrixSlice*/ ctx[5],
    				highlights: /*outputHighlights*/ ctx[4],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	dataview3 = new Dataview({
    			props: {
    				data: /*gridOutputMatrixSlice*/ ctx[6],
    				highlights: /*outputHighlights*/ ctx[4],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	dataview4 = new Dataview({
    			props: {
    				data: /*gridOutput*/ ctx[8],
    				highlights: /*outputHighlights*/ ctx[4],
    				isKernelMath: false,
    				outputLength: /*output*/ ctx[1].length,
    				constraint: getVisualizationSizeConstraint(/*output*/ ctx[1].length),
    				dataRange: /*dataRange*/ ctx[2],
    				stride: 1
    			},
    			$$inline: true
    		});

    	dataview4.$on("message", /*handleMouseover*/ ctx[9]);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Input (");
    			t1 = text(t1_value);
    			t2 = text(", ");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			create_component(dataview0.$$.fragment);
    			t6 = space();
    			div2 = element("div");
    			span = element("span");
    			t7 = text("max(\n    ");
    			create_component(dataview1.$$.fragment);
    			t8 = text("\n    ,\n    ");
    			create_component(dataview2.$$.fragment);
    			t9 = text("\n    )\n    =\n    ");
    			create_component(dataview3.$$.fragment);
    			t10 = space();
    			div4 = element("div");
    			div3 = element("div");
    			t11 = text("Output (");
    			t12 = text(t12_value);
    			t13 = text(", ");
    			t14 = text(t14_value);
    			t15 = text(")");
    			t16 = space();
    			create_component(dataview4.$$.fragment);
    			attr_dev(div0, "class", "header-text");
    			add_location(div0, file$4, 85, 2, 3124);
    			attr_dev(div1, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div1, file$4, 84, 0, 3083);
    			add_location(span, file$4, 92, 2, 3491);
    			attr_dev(div2, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div2, file$4, 91, 0, 3450);
    			attr_dev(div3, "class", "header-text");
    			add_location(div3, file$4, 106, 2, 3993);
    			attr_dev(div4, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div4, file$4, 105, 0, 3952);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);
    			append_dev(div1, t5);
    			mount_component(dataview0, div1, null);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, span);
    			append_dev(span, t7);
    			mount_component(dataview1, span, null);
    			append_dev(span, t8);
    			mount_component(dataview2, span, null);
    			append_dev(span, t9);
    			mount_component(dataview3, span, null);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, t11);
    			append_dev(div3, t12);
    			append_dev(div3, t13);
    			append_dev(div3, t14);
    			append_dev(div3, t15);
    			append_dev(div4, t16);
    			mount_component(dataview4, div4, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*image*/ 1) && t1_value !== (t1_value = /*image*/ ctx[0].length + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*image*/ 1) && t3_value !== (t3_value = /*image*/ ctx[0][0].length + "")) set_data_dev(t3, t3_value);
    			const dataview0_changes = {};
    			if (dirty & /*gridImage*/ 128) dataview0_changes.data = /*gridImage*/ ctx[7];
    			if (dirty & /*inputHighlights*/ 8) dataview0_changes.highlights = /*inputHighlights*/ ctx[3];
    			if (dirty & /*output*/ 2) dataview0_changes.outputLength = /*output*/ ctx[1].length;
    			if (dirty & /*image*/ 1) dataview0_changes.constraint = getVisualizationSizeConstraint(/*image*/ ctx[0].length);
    			if (dirty & /*dataRange*/ 4) dataview0_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview0.$set(dataview0_changes);
    			const dataview1_changes = {};
    			if (dirty & /*outputHighlights*/ 16) dataview1_changes.highlights = /*outputHighlights*/ ctx[4];
    			if (dirty & /*dataRange*/ 4) dataview1_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview1.$set(dataview1_changes);
    			const dataview2_changes = {};
    			if (dirty & /*gridInputMatrixSlice*/ 32) dataview2_changes.data = /*gridInputMatrixSlice*/ ctx[5];
    			if (dirty & /*outputHighlights*/ 16) dataview2_changes.highlights = /*outputHighlights*/ ctx[4];
    			if (dirty & /*dataRange*/ 4) dataview2_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview2.$set(dataview2_changes);
    			const dataview3_changes = {};
    			if (dirty & /*gridOutputMatrixSlice*/ 64) dataview3_changes.data = /*gridOutputMatrixSlice*/ ctx[6];
    			if (dirty & /*outputHighlights*/ 16) dataview3_changes.highlights = /*outputHighlights*/ ctx[4];
    			if (dirty & /*dataRange*/ 4) dataview3_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview3.$set(dataview3_changes);
    			if ((!current || dirty & /*output*/ 2) && t12_value !== (t12_value = /*output*/ ctx[1].length + "")) set_data_dev(t12, t12_value);
    			if ((!current || dirty & /*output*/ 2) && t14_value !== (t14_value = /*output*/ ctx[1][0].length + "")) set_data_dev(t14, t14_value);
    			const dataview4_changes = {};
    			if (dirty & /*gridOutput*/ 256) dataview4_changes.data = /*gridOutput*/ ctx[8];
    			if (dirty & /*outputHighlights*/ 16) dataview4_changes.highlights = /*outputHighlights*/ ctx[4];
    			if (dirty & /*output*/ 2) dataview4_changes.outputLength = /*output*/ ctx[1].length;
    			if (dirty & /*output*/ 2) dataview4_changes.constraint = getVisualizationSizeConstraint(/*output*/ ctx[1].length);
    			if (dirty & /*dataRange*/ 4) dataview4_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview4.$set(dataview4_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dataview0.$$.fragment, local);
    			transition_in(dataview1.$$.fragment, local);
    			transition_in(dataview2.$$.fragment, local);
    			transition_in(dataview3.$$.fragment, local);
    			transition_in(dataview4.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dataview0.$$.fragment, local);
    			transition_out(dataview1.$$.fragment, local);
    			transition_out(dataview2.$$.fragment, local);
    			transition_out(dataview3.$$.fragment, local);
    			transition_out(dataview4.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(dataview0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div2);
    			destroy_component(dataview1);
    			destroy_component(dataview2);
    			destroy_component(dataview3);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(div4);
    			destroy_component(dataview4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const padding$1 = 0;

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ActivationAnimator', slots, []);
    	let { image } = $$props;
    	let { output } = $$props;
    	let { isPaused } = $$props;
    	let { dataRange } = $$props;
    	const dispatch = createEventDispatcher();
    	let padded_input_size = image.length + padding$1 * 2;
    	let gridInputMatrixSlice = gridData([[0]]);
    	let gridOutputMatrixSlice = gridData([[0]]);
    	let inputHighlights = array1d(image.length * image.length, i => true);
    	let outputHighlights = array1d(output.length * output.length, i => true);
    	let interval;
    	let counter;

    	// lots of replication between mouseover and start-relu. TODO: fix this.
    	function startRelu() {
    		counter = 0;
    		if (interval) clearInterval(interval);

    		$$invalidate(11, interval = setInterval(
    			() => {
    				if (isPaused) return;
    				const flat_animated = counter % (output.length * output.length);
    				$$invalidate(4, outputHighlights = array1d(output.length * output.length, i => false));
    				$$invalidate(3, inputHighlights = array1d(image.length * image.length, i => undefined));
    				const animatedH = Math.floor(flat_animated / output.length);
    				const animatedW = flat_animated % output.length;
    				$$invalidate(4, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    				$$invalidate(3, inputHighlights[animatedH * output.length + animatedW] = true, inputHighlights);
    				const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, 1);
    				$$invalidate(5, gridInputMatrixSlice = gridData(inputMatrixSlice));
    				const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    				$$invalidate(6, gridOutputMatrixSlice = gridData(outputMatrixSlice));
    				counter++;
    			},
    			250
    		));
    	}

    	function handleMouseover(event) {
    		$$invalidate(4, outputHighlights = array1d(output.length * output.length, i => false));
    		const animatedH = event.detail.hoverH;
    		const animatedW = event.detail.hoverW;
    		$$invalidate(4, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    		$$invalidate(3, inputHighlights = array1d(image.length * image.length, i => undefined));
    		$$invalidate(3, inputHighlights[animatedH * output.length + animatedW] = true, inputHighlights);
    		const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, 1);
    		$$invalidate(5, gridInputMatrixSlice = gridData(inputMatrixSlice));
    		const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    		$$invalidate(6, gridOutputMatrixSlice = gridData(outputMatrixSlice));
    		$$invalidate(10, isPaused = true);
    		dispatch('message', { text: isPaused });
    	}

    	startRelu();
    	let gridImage = gridData(image);
    	let gridOutput = gridData(output);
    	const writable_props = ['image', 'output', 'isPaused', 'dataRange'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ActivationAnimator> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('image' in $$props) $$invalidate(0, image = $$props.image);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(10, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		array1d,
    		getMatrixSliceFromOutputHighlights,
    		getVisualizationSizeConstraint,
    		getMatrixSliceFromInputHighlights,
    		gridData,
    		Dataview,
    		image,
    		output,
    		isPaused,
    		dataRange,
    		dispatch,
    		padding: padding$1,
    		padded_input_size,
    		gridInputMatrixSlice,
    		gridOutputMatrixSlice,
    		inputHighlights,
    		outputHighlights,
    		interval,
    		counter,
    		startRelu,
    		handleMouseover,
    		gridImage,
    		gridOutput
    	});

    	$$self.$inject_state = $$props => {
    		if ('image' in $$props) $$invalidate(0, image = $$props.image);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(10, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('padded_input_size' in $$props) padded_input_size = $$props.padded_input_size;
    		if ('gridInputMatrixSlice' in $$props) $$invalidate(5, gridInputMatrixSlice = $$props.gridInputMatrixSlice);
    		if ('gridOutputMatrixSlice' in $$props) $$invalidate(6, gridOutputMatrixSlice = $$props.gridOutputMatrixSlice);
    		if ('inputHighlights' in $$props) $$invalidate(3, inputHighlights = $$props.inputHighlights);
    		if ('outputHighlights' in $$props) $$invalidate(4, outputHighlights = $$props.outputHighlights);
    		if ('interval' in $$props) $$invalidate(11, interval = $$props.interval);
    		if ('counter' in $$props) counter = $$props.counter;
    		if ('gridImage' in $$props) $$invalidate(7, gridImage = $$props.gridImage);
    		if ('gridOutput' in $$props) $$invalidate(8, gridOutput = $$props.gridOutput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*image*/ 1) {
    			 padded_input_size = image.length + padding$1 * 2;
    		}

    		if ($$self.$$.dirty & /*image, output*/ 3) {
    			 {
    				let inputHighlights = array1d(image.length * image.length, i => true);
    				let outputHighlights = array1d(output.length * output.length, i => true);
    			}
    		}

    		if ($$self.$$.dirty & /*image, output*/ 3) {
    			 {
    				startRelu();
    				$$invalidate(7, gridImage = gridData(image));
    				$$invalidate(8, gridOutput = gridData(output));
    			}
    		}
    	};

    	return [
    		image,
    		output,
    		dataRange,
    		inputHighlights,
    		outputHighlights,
    		gridInputMatrixSlice,
    		gridOutputMatrixSlice,
    		gridImage,
    		gridOutput,
    		handleMouseover,
    		isPaused,
    		interval
    	];
    }

    class ActivationAnimator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			image: 0,
    			output: 1,
    			isPaused: 10,
    			dataRange: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ActivationAnimator",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*image*/ ctx[0] === undefined && !('image' in props)) {
    			console.warn("<ActivationAnimator> was created without expected prop 'image'");
    		}

    		if (/*output*/ ctx[1] === undefined && !('output' in props)) {
    			console.warn("<ActivationAnimator> was created without expected prop 'output'");
    		}

    		if (/*isPaused*/ ctx[10] === undefined && !('isPaused' in props)) {
    			console.warn("<ActivationAnimator> was created without expected prop 'isPaused'");
    		}

    		if (/*dataRange*/ ctx[2] === undefined && !('dataRange' in props)) {
    			console.warn("<ActivationAnimator> was created without expected prop 'dataRange'");
    		}
    	}

    	get image() {
    		throw new Error("<ActivationAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<ActivationAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<ActivationAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<ActivationAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isPaused() {
    		throw new Error("<ActivationAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isPaused(value) {
    		throw new Error("<ActivationAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<ActivationAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<ActivationAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\Activationview.svelte generated by Svelte v3.47.0 */
    const file$5 = "src\\detail-view\\Activationview.svelte";

    // (95:0) {#if !isExited}
    function create_if_block$1(ctx) {
    	let div10;
    	let div9;
    	let div5;
    	let div0;
    	let t1;
    	let div4;
    	let div1;
    	let i0;
    	let t2;
    	let div2;

    	let raw_value = (/*isPaused*/ ctx[4]
    	? '<i class="fas fa-play-circle play-icon"></i>'
    	: '<i class="fas fa-pause-circle"></i>') + "";

    	let t3;
    	let div3;
    	let i1;
    	let t4;
    	let div6;
    	let activationanimator;
    	let t5;
    	let div8;
    	let img;
    	let img_src_value;
    	let t6;
    	let div7;
    	let span;
    	let t8;
    	let current;
    	let mounted;
    	let dispose;

    	activationanimator = new ActivationAnimator({
    			props: {
    				image: /*input*/ ctx[0],
    				output: /*output*/ ctx[1],
    				isPaused: /*isPaused*/ ctx[4],
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	activationanimator.$on("message", /*handlePauseFromInteraction*/ ctx[6]);

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = "ReLU Activation";
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			i0 = element("i");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			i1 = element("i");
    			t4 = space();
    			div6 = element("div");
    			create_component(activationanimator.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			img = element("img");
    			t6 = space();
    			div7 = element("div");
    			span = element("span");
    			span.textContent = "Hover over";
    			t8 = text(" the matrices to change pixel.");
    			attr_dev(div0, "class", "title-text svelte-1lq7956");
    			add_location(div0, file$5, 100, 8, 1810);
    			attr_dev(i0, "class", "fas fa-info-circle");
    			add_location(i0, file$5, 107, 12, 2015);
    			attr_dev(div1, "class", "control-button svelte-1lq7956");
    			attr_dev(div1, "title", "Jump to article section");
    			add_location(div1, file$5, 106, 10, 1918);
    			attr_dev(div2, "class", "play-button control-button svelte-1lq7956");
    			attr_dev(div2, "title", "Play animation");
    			add_location(div2, file$5, 110, 10, 2078);
    			attr_dev(i1, "class", "fas control-icon fa-times-circle");
    			add_location(i1, file$5, 117, 14, 2439);
    			attr_dev(div3, "class", "delete-button control-button svelte-1lq7956");
    			attr_dev(div3, "title", "Close");
    			add_location(div3, file$5, 116, 10, 2344);
    			attr_dev(div4, "class", "buttons svelte-1lq7956");
    			add_location(div4, file$5, 104, 8, 1885);
    			attr_dev(div5, "class", "control-pannel svelte-1lq7956");
    			add_location(div5, file$5, 98, 6, 1772);
    			attr_dev(div6, "class", "container is-centered is-vcentered svelte-1lq7956");
    			add_location(div6, file$5, 123, 6, 2541);
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/pointer.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pointer icon");
    			attr_dev(img, "class", "svelte-1lq7956");
    			add_location(img, file$5, 130, 8, 2806);
    			set_style(span, "font-weight", "600");
    			add_location(span, file$5, 132, 10, 2919);
    			attr_dev(div7, "class", "annotation-text");
    			add_location(div7, file$5, 131, 8, 2879);
    			attr_dev(div8, "class", "annotation svelte-1lq7956");
    			add_location(div8, file$5, 129, 6, 2773);
    			attr_dev(div9, "class", "box svelte-1lq7956");
    			add_location(div9, file$5, 96, 4, 1747);
    			attr_dev(div10, "class", "container svelte-1lq7956");
    			add_location(div10, file$5, 95, 2, 1719);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, i0);
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			div2.innerHTML = raw_value;
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, i1);
    			append_dev(div9, t4);
    			append_dev(div9, div6);
    			mount_component(activationanimator, div6, null);
    			append_dev(div9, t5);
    			append_dev(div9, div8);
    			append_dev(div8, img);
    			append_dev(div8, t6);
    			append_dev(div8, div7);
    			append_dev(div7, span);
    			append_dev(div7, t8);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", handleScroll$1, false, false, false),
    					listen_dev(div2, "click", /*handleClickPause*/ ctx[5], false, false, false),
    					listen_dev(div3, "click", /*handleClickX*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*isPaused*/ 16) && raw_value !== (raw_value = (/*isPaused*/ ctx[4]
    			? '<i class="fas fa-play-circle play-icon"></i>'
    			: '<i class="fas fa-pause-circle"></i>') + "")) div2.innerHTML = raw_value;
    			const activationanimator_changes = {};
    			if (dirty & /*input*/ 1) activationanimator_changes.image = /*input*/ ctx[0];
    			if (dirty & /*output*/ 2) activationanimator_changes.output = /*output*/ ctx[1];
    			if (dirty & /*isPaused*/ 16) activationanimator_changes.isPaused = /*isPaused*/ ctx[4];
    			if (dirty & /*dataRange*/ 4) activationanimator_changes.dataRange = /*dataRange*/ ctx[2];
    			activationanimator.$set(activationanimator_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(activationanimator.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(activationanimator.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			destroy_component(activationanimator);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(95:0) {#if !isExited}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*isExited*/ ctx[3] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isExited*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isExited*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function handleScroll$1() {
    	let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    	let scroll = new SmoothScroll('a[href*="#"]', { offset: -svgHeight });
    	let anchor = document.querySelector(`#article-relu`);
    	scroll.animateScroll(anchor);
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Activationview', slots, []);
    	let { input } = $$props;
    	let { output } = $$props;
    	let { dataRange } = $$props;
    	let { isExited } = $$props;
    	const dispatch = createEventDispatcher();
    	let isPaused = false;

    	function handleClickPause() {
    		$$invalidate(4, isPaused = !isPaused);
    	}

    	function handlePauseFromInteraction(event) {
    		$$invalidate(4, isPaused = event.detail.text);
    	}

    	function handleClickX() {
    		dispatch('message', { text: true });
    	}

    	const writable_props = ['input', 'output', 'dataRange', 'isExited'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Activationview> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(3, isExited = $$props.isExited);
    	};

    	$$self.$capture_state = () => ({
    		ActivationAnimator,
    		createEventDispatcher,
    		input,
    		output,
    		dataRange,
    		isExited,
    		dispatch,
    		isPaused,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX,
    		handleScroll: handleScroll$1
    	});

    	$$self.$inject_state = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(3, isExited = $$props.isExited);
    		if ('isPaused' in $$props) $$invalidate(4, isPaused = $$props.isPaused);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		input,
    		output,
    		dataRange,
    		isExited,
    		isPaused,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX
    	];
    }

    class Activationview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			input: 0,
    			output: 1,
    			dataRange: 2,
    			isExited: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Activationview",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*input*/ ctx[0] === undefined && !('input' in props)) {
    			console.warn("<Activationview> was created without expected prop 'input'");
    		}

    		if (/*output*/ ctx[1] === undefined && !('output' in props)) {
    			console.warn("<Activationview> was created without expected prop 'output'");
    		}

    		if (/*dataRange*/ ctx[2] === undefined && !('dataRange' in props)) {
    			console.warn("<Activationview> was created without expected prop 'dataRange'");
    		}

    		if (/*isExited*/ ctx[3] === undefined && !('isExited' in props)) {
    			console.warn("<Activationview> was created without expected prop 'isExited'");
    		}
    	}

    	get input() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isExited() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isExited(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\PoolAnimator.svelte generated by Svelte v3.47.0 */
    const file$6 = "src\\detail-view\\PoolAnimator.svelte";

    function create_fragment$6(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1_value = /*testImage*/ ctx[9].length + "";
    	let t1;
    	let t2;
    	let t3_value = /*testImage*/ ctx[9][0].length + "";
    	let t3;
    	let t4;
    	let t5;
    	let dataview0;
    	let t6;
    	let div2;
    	let span;
    	let t7;
    	let dataview1;
    	let t8;
    	let dataview2;
    	let t9;
    	let div4;
    	let div3;
    	let t10;
    	let t11_value = /*testOutput*/ ctx[10].length + "";
    	let t11;
    	let t12;
    	let t13_value = /*testOutput*/ ctx[10][0].length + "";
    	let t13;
    	let t14;
    	let t15;
    	let dataview3;
    	let current;

    	dataview0 = new Dataview({
    			props: {
    				data: /*testImage*/ ctx[9],
    				highlights: /*inputHighlights*/ ctx[5],
    				outputLength: /*output*/ ctx[3].length,
    				isKernelMath: false,
    				constraint: getVisualizationSizeConstraint(/*image*/ ctx[2].length),
    				dataRange: /*dataRange*/ ctx[4],
    				stride: /*stride*/ ctx[0]
    			},
    			$$inline: true
    		});

    	dataview0.$on("message", /*handleMouseover*/ ctx[11]);

    	dataview1 = new Dataview({
    			props: {
    				data: /*testInputMatrixSlice*/ ctx[7],
    				highlights: /*outputHighlights*/ ctx[6],
    				isKernelMath: true,
    				constraint: getVisualizationSizeConstraint(/*kernelLength*/ ctx[1]),
    				dataRange: /*dataRange*/ ctx[4]
    			},
    			$$inline: true
    		});

    	dataview2 = new Dataview({
    			props: {
    				data: /*testOutputMatrixSlice*/ ctx[8],
    				highlights: /*outputHighlights*/ ctx[6],
    				isKernelMath: true,
    				constraint: getVisualizationSizeConstraint(/*kernelLength*/ ctx[1]),
    				dataRange: /*dataRange*/ ctx[4]
    			},
    			$$inline: true
    		});

    	dataview3 = new Dataview({
    			props: {
    				data: /*testOutput*/ ctx[10],
    				highlights: /*outputHighlights*/ ctx[6],
    				isKernelMath: false,
    				outputLength: /*output*/ ctx[3].length,
    				constraint: getVisualizationSizeConstraint(/*output*/ ctx[3].length),
    				dataRange: /*dataRange*/ ctx[4],
    				stride: /*stride*/ ctx[0]
    			},
    			$$inline: true
    		});

    	dataview3.$on("message", /*handleMouseover*/ ctx[11]);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Input (");
    			t1 = text(t1_value);
    			t2 = text(", ");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			create_component(dataview0.$$.fragment);
    			t6 = space();
    			div2 = element("div");
    			span = element("span");
    			t7 = text("max(\n    ");
    			create_component(dataview1.$$.fragment);
    			t8 = text("\n    )\n    =\n    ");
    			create_component(dataview2.$$.fragment);
    			t9 = space();
    			div4 = element("div");
    			div3 = element("div");
    			t10 = text("Output (");
    			t11 = text(t11_value);
    			t12 = text(", ");
    			t13 = text(t13_value);
    			t14 = text(")");
    			t15 = space();
    			create_component(dataview3.$$.fragment);
    			attr_dev(div0, "class", "header-text");
    			add_location(div0, file$6, 99, 2, 3722);
    			attr_dev(div1, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div1, file$6, 98, 0, 3681);
    			add_location(span, file$6, 107, 2, 4103);
    			attr_dev(div2, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div2, file$6, 106, 0, 4062);
    			attr_dev(div3, "class", "header-text");
    			add_location(div3, file$6, 118, 2, 4553);
    			attr_dev(div4, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div4, file$6, 117, 0, 4512);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);
    			append_dev(div1, t5);
    			mount_component(dataview0, div1, null);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, span);
    			append_dev(span, t7);
    			mount_component(dataview1, span, null);
    			append_dev(span, t8);
    			mount_component(dataview2, span, null);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, t10);
    			append_dev(div3, t11);
    			append_dev(div3, t12);
    			append_dev(div3, t13);
    			append_dev(div3, t14);
    			append_dev(div4, t15);
    			mount_component(dataview3, div4, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*testImage*/ 512) && t1_value !== (t1_value = /*testImage*/ ctx[9].length + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*testImage*/ 512) && t3_value !== (t3_value = /*testImage*/ ctx[9][0].length + "")) set_data_dev(t3, t3_value);
    			const dataview0_changes = {};
    			if (dirty & /*testImage*/ 512) dataview0_changes.data = /*testImage*/ ctx[9];
    			if (dirty & /*inputHighlights*/ 32) dataview0_changes.highlights = /*inputHighlights*/ ctx[5];
    			if (dirty & /*output*/ 8) dataview0_changes.outputLength = /*output*/ ctx[3].length;
    			if (dirty & /*image*/ 4) dataview0_changes.constraint = getVisualizationSizeConstraint(/*image*/ ctx[2].length);
    			if (dirty & /*dataRange*/ 16) dataview0_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*stride*/ 1) dataview0_changes.stride = /*stride*/ ctx[0];
    			dataview0.$set(dataview0_changes);
    			const dataview1_changes = {};
    			if (dirty & /*testInputMatrixSlice*/ 128) dataview1_changes.data = /*testInputMatrixSlice*/ ctx[7];
    			if (dirty & /*outputHighlights*/ 64) dataview1_changes.highlights = /*outputHighlights*/ ctx[6];
    			if (dirty & /*kernelLength*/ 2) dataview1_changes.constraint = getVisualizationSizeConstraint(/*kernelLength*/ ctx[1]);
    			if (dirty & /*dataRange*/ 16) dataview1_changes.dataRange = /*dataRange*/ ctx[4];
    			dataview1.$set(dataview1_changes);
    			const dataview2_changes = {};
    			if (dirty & /*testOutputMatrixSlice*/ 256) dataview2_changes.data = /*testOutputMatrixSlice*/ ctx[8];
    			if (dirty & /*outputHighlights*/ 64) dataview2_changes.highlights = /*outputHighlights*/ ctx[6];
    			if (dirty & /*kernelLength*/ 2) dataview2_changes.constraint = getVisualizationSizeConstraint(/*kernelLength*/ ctx[1]);
    			if (dirty & /*dataRange*/ 16) dataview2_changes.dataRange = /*dataRange*/ ctx[4];
    			dataview2.$set(dataview2_changes);
    			if ((!current || dirty & /*testOutput*/ 1024) && t11_value !== (t11_value = /*testOutput*/ ctx[10].length + "")) set_data_dev(t11, t11_value);
    			if ((!current || dirty & /*testOutput*/ 1024) && t13_value !== (t13_value = /*testOutput*/ ctx[10][0].length + "")) set_data_dev(t13, t13_value);
    			const dataview3_changes = {};
    			if (dirty & /*testOutput*/ 1024) dataview3_changes.data = /*testOutput*/ ctx[10];
    			if (dirty & /*outputHighlights*/ 64) dataview3_changes.highlights = /*outputHighlights*/ ctx[6];
    			if (dirty & /*output*/ 8) dataview3_changes.outputLength = /*output*/ ctx[3].length;
    			if (dirty & /*output*/ 8) dataview3_changes.constraint = getVisualizationSizeConstraint(/*output*/ ctx[3].length);
    			if (dirty & /*dataRange*/ 16) dataview3_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*stride*/ 1) dataview3_changes.stride = /*stride*/ ctx[0];
    			dataview3.$set(dataview3_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dataview0.$$.fragment, local);
    			transition_in(dataview1.$$.fragment, local);
    			transition_in(dataview2.$$.fragment, local);
    			transition_in(dataview3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dataview0.$$.fragment, local);
    			transition_out(dataview1.$$.fragment, local);
    			transition_out(dataview2.$$.fragment, local);
    			transition_out(dataview3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(dataview0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div2);
    			destroy_component(dataview1);
    			destroy_component(dataview2);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div4);
    			destroy_component(dataview3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const padding$2 = 0;

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PoolAnimator', slots, []);
    	let { stride } = $$props;
    	let { dilation } = $$props;
    	let { kernelLength } = $$props;
    	let { image } = $$props;
    	let { output } = $$props;
    	let { isPaused } = $$props;
    	let { dataRange } = $$props;
    	const dispatch = createEventDispatcher();
    	let padded_input_size = image.length + padding$2 * 2;

    	// Dummy data for original state of component.
    	let testInputMatrixSlice = [];

    	for (let i = 0; i < kernelLength; i++) {
    		testInputMatrixSlice.push([]);

    		for (let j = 0; j < kernelLength; j++) {
    			testInputMatrixSlice[i].push(0);
    		}
    	}

    	testInputMatrixSlice = gridData(testInputMatrixSlice);
    	let testOutputMatrixSlice = gridData([[0]]);
    	let inputHighlights = [];
    	let outputHighlights = array1d(output.length * output.length, i => true);
    	let interval;
    	let counter;

    	// lots of replication between mouseover and start-pool. TODO: fix this.
    	function startMaxPool(stride) {
    		counter = 0;
    		let outputMappings = generateOutputMappings(stride, output, kernelLength, padded_input_size, dilation);
    		if (stride <= 0) return;
    		if (interval) clearInterval(interval);

    		$$invalidate(14, interval = setInterval(
    			() => {
    				if (isPaused) return;
    				const flat_animated = counter % (output.length * output.length);
    				$$invalidate(6, outputHighlights = array1d(output.length * output.length, i => false));
    				const animatedH = Math.floor(flat_animated / output.length);
    				const animatedW = flat_animated % output.length;
    				$$invalidate(6, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    				$$invalidate(5, inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernelLength, outputMappings, kernelLength));
    				const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernelLength);
    				$$invalidate(7, testInputMatrixSlice = gridData(inputMatrixSlice));
    				const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    				$$invalidate(8, testOutputMatrixSlice = gridData(outputMatrixSlice));
    				counter++;
    			},
    			250
    		));
    	}

    	function handleMouseover(event) {
    		let outputMappings = generateOutputMappings(stride, output, kernelLength, padded_input_size, dilation);
    		$$invalidate(6, outputHighlights = array1d(output.length * output.length, i => false));
    		const animatedH = event.detail.hoverH;
    		const animatedW = event.detail.hoverW;
    		$$invalidate(6, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    		$$invalidate(5, inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernelLength, outputMappings, kernelLength));
    		const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernelLength);
    		$$invalidate(7, testInputMatrixSlice = gridData(inputMatrixSlice));
    		const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    		$$invalidate(8, testOutputMatrixSlice = gridData(outputMatrixSlice));
    		$$invalidate(12, isPaused = true);
    		dispatch('message', { text: isPaused });
    	}

    	startMaxPool(stride);
    	let testImage = gridData(image);
    	let testOutput = gridData(output);

    	const writable_props = [
    		'stride',
    		'dilation',
    		'kernelLength',
    		'image',
    		'output',
    		'isPaused',
    		'dataRange'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PoolAnimator> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('stride' in $$props) $$invalidate(0, stride = $$props.stride);
    		if ('dilation' in $$props) $$invalidate(13, dilation = $$props.dilation);
    		if ('kernelLength' in $$props) $$invalidate(1, kernelLength = $$props.kernelLength);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    		if ('output' in $$props) $$invalidate(3, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(12, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(4, dataRange = $$props.dataRange);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		array1d,
    		getMatrixSliceFromOutputHighlights,
    		compute_input_multiplies_with_weight,
    		getVisualizationSizeConstraint,
    		generateOutputMappings,
    		getMatrixSliceFromInputHighlights,
    		gridData,
    		Dataview,
    		stride,
    		dilation,
    		kernelLength,
    		image,
    		output,
    		isPaused,
    		dataRange,
    		dispatch,
    		padding: padding$2,
    		padded_input_size,
    		testInputMatrixSlice,
    		testOutputMatrixSlice,
    		inputHighlights,
    		outputHighlights,
    		interval,
    		counter,
    		startMaxPool,
    		handleMouseover,
    		testImage,
    		testOutput
    	});

    	$$self.$inject_state = $$props => {
    		if ('stride' in $$props) $$invalidate(0, stride = $$props.stride);
    		if ('dilation' in $$props) $$invalidate(13, dilation = $$props.dilation);
    		if ('kernelLength' in $$props) $$invalidate(1, kernelLength = $$props.kernelLength);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    		if ('output' in $$props) $$invalidate(3, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(12, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(4, dataRange = $$props.dataRange);
    		if ('padded_input_size' in $$props) padded_input_size = $$props.padded_input_size;
    		if ('testInputMatrixSlice' in $$props) $$invalidate(7, testInputMatrixSlice = $$props.testInputMatrixSlice);
    		if ('testOutputMatrixSlice' in $$props) $$invalidate(8, testOutputMatrixSlice = $$props.testOutputMatrixSlice);
    		if ('inputHighlights' in $$props) $$invalidate(5, inputHighlights = $$props.inputHighlights);
    		if ('outputHighlights' in $$props) $$invalidate(6, outputHighlights = $$props.outputHighlights);
    		if ('interval' in $$props) $$invalidate(14, interval = $$props.interval);
    		if ('counter' in $$props) counter = $$props.counter;
    		if ('testImage' in $$props) $$invalidate(9, testImage = $$props.testImage);
    		if ('testOutput' in $$props) $$invalidate(10, testOutput = $$props.testOutput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*image*/ 4) {
    			 padded_input_size = image.length + padding$2 * 2;
    		}

    		if ($$self.$$.dirty & /*output*/ 8) {
    			 {
    				let outputHighlights = array1d(output.length * output.length, i => true);
    			}
    		}

    		if ($$self.$$.dirty & /*stride, image, output*/ 13) {
    			 {
    				startMaxPool(stride);
    				$$invalidate(9, testImage = gridData(image));
    				$$invalidate(10, testOutput = gridData(output));
    			}
    		}
    	};

    	return [
    		stride,
    		kernelLength,
    		image,
    		output,
    		dataRange,
    		inputHighlights,
    		outputHighlights,
    		testInputMatrixSlice,
    		testOutputMatrixSlice,
    		testImage,
    		testOutput,
    		handleMouseover,
    		isPaused,
    		dilation,
    		interval
    	];
    }

    class PoolAnimator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			stride: 0,
    			dilation: 13,
    			kernelLength: 1,
    			image: 2,
    			output: 3,
    			isPaused: 12,
    			dataRange: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PoolAnimator",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*stride*/ ctx[0] === undefined && !('stride' in props)) {
    			console.warn("<PoolAnimator> was created without expected prop 'stride'");
    		}

    		if (/*dilation*/ ctx[13] === undefined && !('dilation' in props)) {
    			console.warn("<PoolAnimator> was created without expected prop 'dilation'");
    		}

    		if (/*kernelLength*/ ctx[1] === undefined && !('kernelLength' in props)) {
    			console.warn("<PoolAnimator> was created without expected prop 'kernelLength'");
    		}

    		if (/*image*/ ctx[2] === undefined && !('image' in props)) {
    			console.warn("<PoolAnimator> was created without expected prop 'image'");
    		}

    		if (/*output*/ ctx[3] === undefined && !('output' in props)) {
    			console.warn("<PoolAnimator> was created without expected prop 'output'");
    		}

    		if (/*isPaused*/ ctx[12] === undefined && !('isPaused' in props)) {
    			console.warn("<PoolAnimator> was created without expected prop 'isPaused'");
    		}

    		if (/*dataRange*/ ctx[4] === undefined && !('dataRange' in props)) {
    			console.warn("<PoolAnimator> was created without expected prop 'dataRange'");
    		}
    	}

    	get stride() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set stride(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dilation() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dilation(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernelLength() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernelLength(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get image() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isPaused() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isPaused(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\Poolview.svelte generated by Svelte v3.47.0 */

    const { console: console_1$1 } = globals;
    const file$7 = "src\\detail-view\\Poolview.svelte";

    // (139:0) {#if !isExited}
    function create_if_block$2(ctx) {
    	let div10;
    	let div9;
    	let div5;
    	let div0;
    	let t1;
    	let div4;
    	let div1;
    	let i0;
    	let t2;
    	let div2;

    	let raw_value = (/*isPaused*/ ctx[4]
    	? '<i class="fas fa-play-circle play-icon"></i>'
    	: '<i class="fas fa-pause-circle"></i>') + "";

    	let t3;
    	let div3;
    	let i1;
    	let t4;
    	let div6;
    	let poolanimator;
    	let t5;
    	let div8;
    	let img;
    	let img_src_value;
    	let t6;
    	let div7;
    	let span;
    	let t8;
    	let current;
    	let mounted;
    	let dispose;

    	poolanimator = new PoolAnimator({
    			props: {
    				kernelLength: /*kernelLength*/ ctx[1],
    				image: /*input*/ ctx[0],
    				output: /*outputFinal*/ ctx[5],
    				stride: /*stride*/ ctx[6],
    				dilation: dilation$1,
    				isPaused: /*isPaused*/ ctx[4],
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	poolanimator.$on("message", /*handlePauseFromInteraction*/ ctx[8]);

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = "Max Pooling";
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			i0 = element("i");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			i1 = element("i");
    			t4 = space();
    			div6 = element("div");
    			create_component(poolanimator.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			img = element("img");
    			t6 = space();
    			div7 = element("div");
    			span = element("span");
    			span.textContent = "Hover over";
    			t8 = text(" the matrices to change kernel position.");
    			attr_dev(div0, "class", "title-text svelte-kahisg");
    			add_location(div0, file$7, 160, 8, 3597);
    			attr_dev(i0, "class", "fas fa-info-circle");
    			add_location(i0, file$7, 167, 12, 3798);
    			attr_dev(div1, "class", "control-button svelte-kahisg");
    			attr_dev(div1, "title", "Jump to article section");
    			add_location(div1, file$7, 166, 10, 3701);
    			attr_dev(div2, "class", "play-button control-button svelte-kahisg");
    			attr_dev(div2, "title", "Play animation");
    			add_location(div2, file$7, 170, 10, 3861);
    			attr_dev(i1, "class", "fas control-icon fa-times-circle");
    			add_location(i1, file$7, 177, 12, 4220);
    			attr_dev(div3, "class", "delete-button control-button svelte-kahisg");
    			attr_dev(div3, "title", "Close");
    			add_location(div3, file$7, 176, 10, 4127);
    			attr_dev(div4, "class", "buttons svelte-kahisg");
    			add_location(div4, file$7, 164, 8, 3668);
    			attr_dev(div5, "class", "control-pannel svelte-kahisg");
    			add_location(div5, file$7, 158, 6, 3553);
    			attr_dev(div6, "class", "container is-centered is-vcentered svelte-kahisg");
    			add_location(div6, file$7, 183, 6, 4322);
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/pointer.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pointer icon");
    			attr_dev(img, "class", "svelte-kahisg");
    			add_location(img, file$7, 191, 8, 4662);
    			set_style(span, "font-weight", "600");
    			add_location(span, file$7, 193, 12, 4779);
    			attr_dev(div7, "class", "annotation-text");
    			add_location(div7, file$7, 192, 10, 4737);
    			attr_dev(div8, "class", "annotation svelte-kahisg");
    			add_location(div8, file$7, 190, 6, 4629);
    			attr_dev(div9, "class", "box svelte-kahisg");
    			add_location(div9, file$7, 156, 4, 3528);
    			attr_dev(div10, "class", "container svelte-kahisg");
    			add_location(div10, file$7, 139, 2, 2971);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, i0);
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			div2.innerHTML = raw_value;
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, i1);
    			append_dev(div9, t4);
    			append_dev(div9, div6);
    			mount_component(poolanimator, div6, null);
    			append_dev(div9, t5);
    			append_dev(div9, div8);
    			append_dev(div8, img);
    			append_dev(div8, t6);
    			append_dev(div8, div7);
    			append_dev(div7, span);
    			append_dev(div7, t8);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", handleScroll$2, false, false, false),
    					listen_dev(div2, "click", /*handleClickPause*/ ctx[7], false, false, false),
    					listen_dev(div3, "click", /*handleClickX*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*isPaused*/ 16) && raw_value !== (raw_value = (/*isPaused*/ ctx[4]
    			? '<i class="fas fa-play-circle play-icon"></i>'
    			: '<i class="fas fa-pause-circle"></i>') + "")) div2.innerHTML = raw_value;
    			const poolanimator_changes = {};
    			if (dirty & /*kernelLength*/ 2) poolanimator_changes.kernelLength = /*kernelLength*/ ctx[1];
    			if (dirty & /*input*/ 1) poolanimator_changes.image = /*input*/ ctx[0];
    			if (dirty & /*outputFinal*/ 32) poolanimator_changes.output = /*outputFinal*/ ctx[5];
    			if (dirty & /*isPaused*/ 16) poolanimator_changes.isPaused = /*isPaused*/ ctx[4];
    			if (dirty & /*dataRange*/ 4) poolanimator_changes.dataRange = /*dataRange*/ ctx[2];
    			poolanimator.$set(poolanimator_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(poolanimator.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(poolanimator.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			destroy_component(poolanimator);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(139:0) {#if !isExited}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*isExited*/ ctx[3] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isExited*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isExited*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const dilation$1 = 1;

    function handleScroll$2() {
    	let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    	let scroll = new SmoothScroll('a[href*="#"]', { offset: -svgHeight });
    	let anchor = document.querySelector(`#article-pooling`);
    	scroll.animateScroll(anchor);
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Poolview', slots, []);
    	let { input } = $$props;
    	let { kernelLength } = $$props;
    	let { dataRange } = $$props;
    	let { isExited } = $$props;
    	const dispatch = createEventDispatcher();

    	// let isExited = false;
    	let stride = 2;

    	var isPaused = false;
    	var outputFinal = singleMaxPooling(input);

    	function handleClickPause() {
    		$$invalidate(4, isPaused = !isPaused);
    		console.log(isPaused);
    	}

    	function handlePauseFromInteraction(event) {
    		$$invalidate(4, isPaused = event.detail.text);
    	}

    	function handleClickX() {
    		dispatch('message', { text: true });
    	}

    	const writable_props = ['input', 'kernelLength', 'dataRange', 'isExited'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Poolview> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('kernelLength' in $$props) $$invalidate(1, kernelLength = $$props.kernelLength);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(3, isExited = $$props.isExited);
    	};

    	$$self.$capture_state = () => ({
    		PoolAnimator,
    		singleMaxPooling,
    		createEventDispatcher,
    		input,
    		kernelLength,
    		dataRange,
    		isExited,
    		dispatch,
    		stride,
    		dilation: dilation$1,
    		isPaused,
    		outputFinal,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX,
    		handleScroll: handleScroll$2
    	});

    	$$self.$inject_state = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('kernelLength' in $$props) $$invalidate(1, kernelLength = $$props.kernelLength);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(3, isExited = $$props.isExited);
    		if ('stride' in $$props) $$invalidate(6, stride = $$props.stride);
    		if ('isPaused' in $$props) $$invalidate(4, isPaused = $$props.isPaused);
    		if ('outputFinal' in $$props) $$invalidate(5, outputFinal = $$props.outputFinal);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*input*/ 1) {
    			// let dragging = false;
    			// let dragInfo = {x1: 0, x2: 0, y1: 0, y2: 0};
    			// let detailView = d3.select('#detailview').node();
    			 if (stride > 0) {
    				try {
    					$$invalidate(5, outputFinal = singleMaxPooling(input));
    				} catch {
    					console.log("Cannot handle stride of " + stride);
    				}
    			}
    		}
    	};

    	return [
    		input,
    		kernelLength,
    		dataRange,
    		isExited,
    		isPaused,
    		outputFinal,
    		stride,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX
    	];
    }

    class Poolview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			input: 0,
    			kernelLength: 1,
    			dataRange: 2,
    			isExited: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Poolview",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*input*/ ctx[0] === undefined && !('input' in props)) {
    			console_1$1.warn("<Poolview> was created without expected prop 'input'");
    		}

    		if (/*kernelLength*/ ctx[1] === undefined && !('kernelLength' in props)) {
    			console_1$1.warn("<Poolview> was created without expected prop 'kernelLength'");
    		}

    		if (/*dataRange*/ ctx[2] === undefined && !('dataRange' in props)) {
    			console_1$1.warn("<Poolview> was created without expected prop 'dataRange'");
    		}

    		if (/*isExited*/ ctx[3] === undefined && !('isExited' in props)) {
    			console_1$1.warn("<Poolview> was created without expected prop 'isExited'");
    		}
    	}

    	get input() {
    		throw new Error("<Poolview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<Poolview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernelLength() {
    		throw new Error("<Poolview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernelLength(value) {
    		throw new Error("<Poolview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<Poolview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<Poolview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isExited() {
    		throw new Error("<Poolview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isExited(value) {
    		throw new Error("<Poolview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\Softmaxview.svelte generated by Svelte v3.47.0 */
    const file$8 = "src\\detail-view\\Softmaxview.svelte";

    function create_fragment$8(ctx) {
    	let div7;
    	let div6;
    	let div2;
    	let div0;
    	let i0;
    	let t0;
    	let div1;
    	let i1;
    	let t1;
    	let div3;
    	let t2;
    	let i2;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let svg_1;
    	let t7;
    	let div5;
    	let img;
    	let img_src_value;
    	let t8;
    	let div4;
    	let span;
    	let t10;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div6 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			i0 = element("i");
    			t0 = space();
    			div1 = element("div");
    			i1 = element("i");
    			t1 = space();
    			div3 = element("div");
    			t2 = text("Softmax Score for ");
    			i2 = element("i");
    			t3 = text("\"");
    			t4 = text(/*outputName*/ ctx[0]);
    			t5 = text("\"");
    			t6 = space();
    			svg_1 = svg_element("svg");
    			t7 = space();
    			div5 = element("div");
    			img = element("img");
    			t8 = space();
    			div4 = element("div");
    			span = element("span");
    			span.textContent = "Hover over";
    			t10 = text(" the numbers to highlight logit circles.");
    			attr_dev(i0, "class", "fas fa-info-circle");
    			add_location(i0, file$8, 261, 8, 6863);
    			attr_dev(div0, "class", "control-button svelte-1uac4ng");
    			attr_dev(div0, "title", "Jump to article section");
    			add_location(div0, file$8, 260, 6, 6770);
    			attr_dev(i1, "class", "fas control-icon fa-times-circle");
    			add_location(i1, file$8, 265, 8, 7007);
    			attr_dev(div1, "class", "delete-button control-button svelte-1uac4ng");
    			attr_dev(div1, "title", "Close");
    			add_location(div1, file$8, 264, 6, 6918);
    			attr_dev(div2, "class", "buttons svelte-1uac4ng");
    			add_location(div2, file$8, 259, 4, 6742);
    			add_location(i2, file$8, 270, 24, 7134);
    			attr_dev(div3, "class", "title-text svelte-1uac4ng");
    			add_location(div3, file$8, 269, 4, 7085);
    			attr_dev(svg_1, "id", "softmax-svg");
    			attr_dev(svg_1, "width", "470");
    			attr_dev(svg_1, "height", "105");
    			attr_dev(svg_1, "class", "svelte-1uac4ng");
    			add_location(svg_1, file$8, 273, 4, 7172);
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/pointer.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pointer icon");
    			attr_dev(img, "class", "svelte-1uac4ng");
    			add_location(img, file$8, 276, 6, 7257);
    			set_style(span, "font-weight", "600");
    			add_location(span, file$8, 278, 8, 7366);
    			attr_dev(div4, "class", "annotation-text");
    			add_location(div4, file$8, 277, 6, 7328);
    			attr_dev(div5, "class", "annotation svelte-1uac4ng");
    			add_location(div5, file$8, 275, 4, 7226);
    			attr_dev(div6, "class", "box svelte-1uac4ng");
    			add_location(div6, file$8, 257, 2, 6719);
    			attr_dev(div7, "class", "container");
    			add_location(div7, file$8, 256, 0, 6660);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			append_dev(div7, div6);
    			append_dev(div6, div2);
    			append_dev(div2, div0);
    			append_dev(div0, i0);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, i1);
    			append_dev(div6, t1);
    			append_dev(div6, div3);
    			append_dev(div3, t2);
    			append_dev(div3, i2);
    			append_dev(i2, t3);
    			append_dev(i2, t4);
    			append_dev(i2, t5);
    			append_dev(div6, t6);
    			append_dev(div6, svg_1);
    			append_dev(div6, t7);
    			append_dev(div6, div5);
    			append_dev(div5, img);
    			append_dev(div5, t8);
    			append_dev(div5, div4);
    			append_dev(div4, span);
    			append_dev(div4, t10);
    			/*div7_binding*/ ctx[10](div7);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", handleScroll$3, false, false, false),
    					listen_dev(div1, "click", /*handleClickX*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*outputName*/ 1) set_data_dev(t4, /*outputName*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			/*div7_binding*/ ctx[10](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function handleScroll$3() {
    	let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    	let scroll = new SmoothScroll('a[href*="#"]', { offset: -svgHeight });
    	let anchor = document.querySelector(`#article-softmax`);
    	scroll.animateScroll(anchor);
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Softmaxview', slots, []);
    	let { logits } = $$props;
    	let { logitColors } = $$props;
    	let { selectedI } = $$props;
    	let { highlightI = -1 } = $$props;
    	let { outputName } = $$props;
    	let { outputValue } = $$props;
    	let { startAnimation } = $$props;
    	let softmaxViewComponent;
    	let svg = null;
    	const dispatch = createEventDispatcher();

    	const formater = (n, d) => {
    		if (d === undefined) {
    			return d3.format('.2f')(n);
    		} else {
    			return d3.format(`.${d}f`)(n);
    		}
    	};

    	const mouseOverHandler = (d, i, g, curI) => {
    		$$invalidate(3, highlightI = curI);
    		dispatch('mouseOver', { curI });
    	};

    	const mouseLeaveHandler = (d, i, g, curI) => {
    		$$invalidate(3, highlightI = -1);
    		dispatch('mouseLeave', { curI });
    	};

    	const handleClickX = () => {
    		dispatch('xClicked', {});
    	};

    	onMount(() => {
    		$$invalidate(9, svg = d3.select(softmaxViewComponent).select('#softmax-svg'));
    		let formulaRightGroup = svg.append('g').attr('class', 'formula-right').attr('transform', `translate(${10}, ${0})`).style('font-size', '15px');

    		// Denominator
    		let denominatorGroup = formulaRightGroup.append('g').attr('class', 'denominator').attr('transform', `translate(${0}, ${58})`);

    		// Add the left (
    		denominatorGroup.append('text').attr('x', 0).attr('y', 0).style('fill', 'gray').text('(');

    		// Need to loop through the logits array instead of data-binding because
    		// we want dynamic positioning based on prior '-' occurance
    		let curX = 8;

    		let numOfRows = 4;

    		logits.forEach((d, i) => {
    			if (i / numOfRows >= 1 && i % numOfRows === 0) {
    				curX = 8;
    			}

    			let curText = denominatorGroup.append('text').attr('x', curX).attr('y', Math.floor(i / numOfRows) * 20).style('cursor', 'crosshair').style('pointer-events', 'all').on('mouseover', (d, n, g) => mouseOverHandler(d, n, g, i)).on('mouseleave', (d, n, g) => mouseLeaveHandler(d, n, g, i)).text(`exp(`);
    			curText.append('tspan').attr('class', `formula-term-${i} formula-term`).attr('dx', '1').style('fill', logitColors[i]).style('fill-opacity', i === selectedI || startAnimation.hasInitialized ? 1 : 0).text(formater(d));
    			curText.append('tspan').attr('dx', '1').text(')');
    			let curBBox = curText.node().getBBox();
    			curX += curBBox.width + 4;

    			if (i !== logits.length - 1) {
    				denominatorGroup.append('text').attr('x', curX).attr('y', Math.floor(i / numOfRows) * 20).text('+');
    				curX += 14;
    			} else {
    				denominatorGroup.append('text').attr('x', curX - 2).attr('y', Math.floor(i / numOfRows) * 20).style('fill', 'gray').text(')');
    			}
    		});

    		denominatorGroup.selectAll('text').data(logits).enter().append('text').attr('x', (d, i) => 40 * i).attr('y', 0).text(d => formater(d));

    		// Calculate the dynamic denominator group width
    		let denominatorGroupBBox = denominatorGroup.node().getBBox();

    		// Draw the fraction line
    		formulaRightGroup.append('line').attr('class', 'separation-line').attr('x1', -5).attr('x2', denominatorGroupBBox.width + 5).attr('y1', 32).attr('y2', 32).style('stroke-width', 1.2).style('stroke', 'gray');

    		// Draw the numerator
    		let numeratorGroup = formulaRightGroup.append('g').attr('class', 'numerator-group').attr('transform', `translate(${0}, ${20})`);

    		let numeratorText = numeratorGroup.append('text').attr('x', denominatorGroupBBox.x + denominatorGroupBBox.width / 2).attr('y', 0).on('mouseover', (d, n, g) => mouseOverHandler(d, n, g, selectedI)).on('mouseleave', (d, n, g) => mouseLeaveHandler(d, n, g, selectedI)).style('pointer-events', 'all').style('cursor', 'crosshair').style('text-anchor', 'middle').text('exp(');
    		numeratorText.append('tspan').attr('class', `formula-term-${selectedI} formula-term`).attr('dx', 1).style('fill', logitColors[selectedI]).text(`${formater(logits[selectedI])}`);
    		numeratorText.append('tspan').attr('dx', 1).text(')');

    		// Draw the left part of the formula
    		let formulaLeftGroup = svg.append('g').attr('class', 'formula-left').attr('transform', `translate(${395}, ${32})`);

    		let softmaxText = formulaLeftGroup.append('text').attr('x', 20).attr('dominant-baseline', 'middle').text(`${formater(outputValue, 4)}`);
    		let softmaxTextBBox = softmaxText.node().getBBox();
    		formulaLeftGroup.append('text').attr('dominant-baseline', 'middle').attr('x', 0).attr('y', 0).style('fill', 'gray').style('font-weight', 'bold').text('=');
    	});

    	const writable_props = [
    		'logits',
    		'logitColors',
    		'selectedI',
    		'highlightI',
    		'outputName',
    		'outputValue',
    		'startAnimation'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Softmaxview> was created with unknown prop '${key}'`);
    	});

    	function div7_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			softmaxViewComponent = $$value;
    			$$invalidate(1, softmaxViewComponent);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('logits' in $$props) $$invalidate(4, logits = $$props.logits);
    		if ('logitColors' in $$props) $$invalidate(5, logitColors = $$props.logitColors);
    		if ('selectedI' in $$props) $$invalidate(6, selectedI = $$props.selectedI);
    		if ('highlightI' in $$props) $$invalidate(3, highlightI = $$props.highlightI);
    		if ('outputName' in $$props) $$invalidate(0, outputName = $$props.outputName);
    		if ('outputValue' in $$props) $$invalidate(7, outputValue = $$props.outputValue);
    		if ('startAnimation' in $$props) $$invalidate(8, startAnimation = $$props.startAnimation);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		afterUpdate,
    		createEventDispatcher,
    		logits,
    		logitColors,
    		selectedI,
    		highlightI,
    		outputName,
    		outputValue,
    		startAnimation,
    		softmaxViewComponent,
    		svg,
    		dispatch,
    		formater,
    		mouseOverHandler,
    		mouseLeaveHandler,
    		handleClickX,
    		handleScroll: handleScroll$3
    	});

    	$$self.$inject_state = $$props => {
    		if ('logits' in $$props) $$invalidate(4, logits = $$props.logits);
    		if ('logitColors' in $$props) $$invalidate(5, logitColors = $$props.logitColors);
    		if ('selectedI' in $$props) $$invalidate(6, selectedI = $$props.selectedI);
    		if ('highlightI' in $$props) $$invalidate(3, highlightI = $$props.highlightI);
    		if ('outputName' in $$props) $$invalidate(0, outputName = $$props.outputName);
    		if ('outputValue' in $$props) $$invalidate(7, outputValue = $$props.outputValue);
    		if ('startAnimation' in $$props) $$invalidate(8, startAnimation = $$props.startAnimation);
    		if ('softmaxViewComponent' in $$props) $$invalidate(1, softmaxViewComponent = $$props.softmaxViewComponent);
    		if ('svg' in $$props) $$invalidate(9, svg = $$props.svg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*highlightI, svg*/ 520) {
    			 ((() => {
    				if (svg !== null) {
    					svg.selectAll(`.formula-term`).style('text-decoration', 'none').style('font-weight', 'normal');
    					svg.selectAll(`.formula-term-${highlightI}`).style('font-weight', 'bold').style('text-decoration', 'underline');
    				}
    			})());
    		}

    		if ($$self.$$.dirty & /*startAnimation, svg*/ 768) {
    			 ((() => {
    				if (svg !== null) {
    					svg.select(`.formula-term-${startAnimation.i}`).transition('softmax-edge').duration(startAnimation.duration).style('fill-opacity', 1);
    				}
    			})());
    		}
    	};

    	return [
    		outputName,
    		softmaxViewComponent,
    		handleClickX,
    		highlightI,
    		logits,
    		logitColors,
    		selectedI,
    		outputValue,
    		startAnimation,
    		svg,
    		div7_binding
    	];
    }

    class Softmaxview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {
    			logits: 4,
    			logitColors: 5,
    			selectedI: 6,
    			highlightI: 3,
    			outputName: 0,
    			outputValue: 7,
    			startAnimation: 8
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Softmaxview",
    			options,
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*logits*/ ctx[4] === undefined && !('logits' in props)) {
    			console.warn("<Softmaxview> was created without expected prop 'logits'");
    		}

    		if (/*logitColors*/ ctx[5] === undefined && !('logitColors' in props)) {
    			console.warn("<Softmaxview> was created without expected prop 'logitColors'");
    		}

    		if (/*selectedI*/ ctx[6] === undefined && !('selectedI' in props)) {
    			console.warn("<Softmaxview> was created without expected prop 'selectedI'");
    		}

    		if (/*outputName*/ ctx[0] === undefined && !('outputName' in props)) {
    			console.warn("<Softmaxview> was created without expected prop 'outputName'");
    		}

    		if (/*outputValue*/ ctx[7] === undefined && !('outputValue' in props)) {
    			console.warn("<Softmaxview> was created without expected prop 'outputValue'");
    		}

    		if (/*startAnimation*/ ctx[8] === undefined && !('startAnimation' in props)) {
    			console.warn("<Softmaxview> was created without expected prop 'startAnimation'");
    		}
    	}

    	get logits() {
    		throw new Error("<Softmaxview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set logits(value) {
    		throw new Error("<Softmaxview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get logitColors() {
    		throw new Error("<Softmaxview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set logitColors(value) {
    		throw new Error("<Softmaxview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedI() {
    		throw new Error("<Softmaxview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedI(value) {
    		throw new Error("<Softmaxview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get highlightI() {
    		throw new Error("<Softmaxview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set highlightI(value) {
    		throw new Error("<Softmaxview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get outputName() {
    		throw new Error("<Softmaxview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set outputName(value) {
    		throw new Error("<Softmaxview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get outputValue() {
    		throw new Error("<Softmaxview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set outputValue(value) {
    		throw new Error("<Softmaxview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get startAnimation() {
    		throw new Error("<Softmaxview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set startAnimation(value) {
    		throw new Error("<Softmaxview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\overview\Modal.svelte generated by Svelte v3.47.0 */
    const file$9 = "src\\overview\\Modal.svelte";

    function create_fragment$9(ctx) {
    	let div9;
    	let div8;
    	let div0;
    	let t0;
    	let div7;
    	let header;
    	let p;
    	let t2;
    	let button0;
    	let t3;
    	let section;
    	let div4;
    	let div1;
    	let input0;
    	let t4;
    	let span0;
    	let i0;
    	let t5;
    	let div2;
    	let t7;
    	let div3;
    	let label;
    	let input1;
    	let t8;
    	let span3;
    	let span1;
    	let i1;
    	let t9;
    	let span2;
    	let t11;
    	let footer;
    	let div5;
    	let t12_value = /*errorInfo*/ ctx[5].error + "";
    	let t12;
    	let t13;
    	let div6;
    	let button1;
    	let t15;
    	let button2;
    	let t17;
    	let img;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			div8 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div7 = element("div");
    			header = element("header");
    			p = element("p");
    			p.textContent = "Add Input Image";
    			t2 = space();
    			button0 = element("button");
    			t3 = space();
    			section = element("section");
    			div4 = element("div");
    			div1 = element("div");
    			input0 = element("input");
    			t4 = space();
    			span0 = element("span");
    			i0 = element("i");
    			t5 = space();
    			div2 = element("div");
    			div2.textContent = "or";
    			t7 = space();
    			div3 = element("div");
    			label = element("label");
    			input1 = element("input");
    			t8 = space();
    			span3 = element("span");
    			span1 = element("span");
    			i1 = element("i");
    			t9 = space();
    			span2 = element("span");
    			span2.textContent = "Upload";
    			t11 = space();
    			footer = element("footer");
    			div5 = element("div");
    			t12 = text(t12_value);
    			t13 = space();
    			div6 = element("div");
    			button1 = element("button");
    			button1.textContent = "Cancel";
    			t15 = space();
    			button2 = element("button");
    			button2.textContent = "Add";
    			t17 = space();
    			img = element("img");
    			attr_dev(div0, "class", "modal-background");
    			add_location(div0, file$9, 151, 4, 3288);
    			attr_dev(p, "class", "modal-card-title svelte-1o5lxfe");
    			add_location(p, file$9, 155, 8, 3426);
    			attr_dev(button0, "class", "delete");
    			attr_dev(button0, "aria-label", "close");
    			add_location(button0, file$9, 156, 8, 3482);
    			attr_dev(header, "class", "modal-card-head svelte-1o5lxfe");
    			add_location(header, file$9, 154, 6, 3385);
    			attr_dev(input0, "class", "input small-font svelte-1o5lxfe");
    			attr_dev(input0, "type", "url");
    			attr_dev(input0, "placeholder", "Paste URL of image...");
    			add_location(input0, file$9, 164, 12, 3746);
    			attr_dev(i0, "class", "fas fa-link");
    			add_location(i0, file$9, 169, 14, 3944);
    			attr_dev(span0, "class", "icon small-font is-left svelte-1o5lxfe");
    			add_location(span0, file$9, 168, 12, 3891);
    			attr_dev(div1, "class", "control has-icons-left svelte-1o5lxfe");
    			toggle_class(div1, "is-loading", /*showLoading*/ ctx[3]);
    			add_location(div1, file$9, 161, 10, 3653);
    			attr_dev(div2, "class", "or-label svelte-1o5lxfe");
    			add_location(div2, file$9, 174, 10, 4021);
    			attr_dev(input1, "class", "file-input");
    			attr_dev(input1, "type", "file");
    			attr_dev(input1, "name", "image");
    			attr_dev(input1, "accept", ".png,.jpeg,.tiff,.jpg,.png");
    			add_location(input1, file$9, 178, 14, 4135);
    			attr_dev(i1, "class", "fas fa-upload");
    			add_location(i1, file$9, 184, 18, 4422);
    			attr_dev(span1, "class", "file-icon");
    			add_location(span1, file$9, 183, 16, 4379);
    			attr_dev(span2, "class", "file-label");
    			add_location(span2, file$9, 186, 16, 4492);
    			attr_dev(span3, "class", "file-cta small-font svelte-1o5lxfe");
    			add_location(span3, file$9, 182, 14, 4328);
    			attr_dev(label, "class", "file-label");
    			add_location(label, file$9, 177, 12, 4094);
    			attr_dev(div3, "class", "file");
    			add_location(div3, file$9, 176, 10, 4063);
    			attr_dev(div4, "class", "field svelte-1o5lxfe");
    			add_location(div4, file$9, 160, 8, 3623);
    			attr_dev(section, "class", "modal-card-body");
    			add_location(section, file$9, 159, 6, 3581);
    			attr_dev(div5, "class", "error-message svelte-1o5lxfe");
    			toggle_class(div5, "hidden", !/*errorInfo*/ ctx[5].show);
    			add_location(div5, file$9, 199, 8, 4710);
    			attr_dev(button1, "class", "button is-smaller svelte-1o5lxfe");
    			add_location(button1, file$9, 205, 10, 4872);
    			attr_dev(button2, "class", "button is-success is-smaller svelte-1o5lxfe");
    			add_location(button2, file$9, 210, 10, 4993);
    			attr_dev(div6, "class", "button-container");
    			add_location(div6, file$9, 204, 8, 4831);
    			attr_dev(footer, "class", "modal-card-foot svelte-1o5lxfe");
    			add_location(footer, file$9, 197, 6, 4668);
    			attr_dev(div7, "class", "modal-card svelte-1o5lxfe");
    			add_location(div7, file$9, 153, 4, 3354);
    			attr_dev(div8, "class", "modal");
    			attr_dev(div8, "id", "input-modal");
    			toggle_class(div8, "is-active", /*modalInfo*/ ctx[6].show);
    			add_location(div8, file$9, 147, 2, 3205);
    			set_style(img, "display", "none");
    			attr_dev(img, "id", "vali-image");
    			attr_dev(img, "alt", "hidden image");
    			add_location(img, file$9, 223, 2, 5236);
    			attr_dev(div9, "class", "modal-component");
    			add_location(div9, file$9, 144, 0, 3143);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div9, anchor);
    			append_dev(div9, div8);
    			append_dev(div8, div0);
    			append_dev(div8, t0);
    			append_dev(div8, div7);
    			append_dev(div7, header);
    			append_dev(header, p);
    			append_dev(header, t2);
    			append_dev(header, button0);
    			append_dev(div7, t3);
    			append_dev(div7, section);
    			append_dev(section, div4);
    			append_dev(div4, div1);
    			append_dev(div1, input0);
    			set_input_value(input0, /*inputValue*/ ctx[2]);
    			append_dev(div1, t4);
    			append_dev(div1, span0);
    			append_dev(span0, i0);
    			append_dev(div4, t5);
    			append_dev(div4, div2);
    			append_dev(div4, t7);
    			append_dev(div4, div3);
    			append_dev(div3, label);
    			append_dev(label, input1);
    			append_dev(label, t8);
    			append_dev(label, span3);
    			append_dev(span3, span1);
    			append_dev(span1, i1);
    			append_dev(span3, t9);
    			append_dev(span3, span2);
    			append_dev(div7, t11);
    			append_dev(div7, footer);
    			append_dev(footer, div5);
    			append_dev(div5, t12);
    			append_dev(footer, t13);
    			append_dev(footer, div6);
    			append_dev(div6, button1);
    			append_dev(div6, t15);
    			append_dev(div6, button2);
    			append_dev(div9, t17);
    			append_dev(div9, img);
    			/*img_binding*/ ctx[14](img);
    			/*div9_binding*/ ctx[15](div9);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", /*crossClicked*/ ctx[10], false, false, false),
    					listen_dev(button0, "click", /*crossClicked*/ ctx[10], false, false, false),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[12]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[13]),
    					listen_dev(input1, "change", /*imageUpload*/ ctx[9], false, false, false),
    					listen_dev(button1, "click", /*crossClicked*/ ctx[10], false, false, false),
    					listen_dev(button2, "click", /*addClicked*/ ctx[11], false, false, false),
    					listen_dev(img, "error", /*errorCallback*/ ctx[7], false, false, false),
    					listen_dev(img, "load", /*loadCallback*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*inputValue*/ 4) {
    				set_input_value(input0, /*inputValue*/ ctx[2]);
    			}

    			if (dirty & /*showLoading*/ 8) {
    				toggle_class(div1, "is-loading", /*showLoading*/ ctx[3]);
    			}

    			if (dirty & /*errorInfo*/ 32 && t12_value !== (t12_value = /*errorInfo*/ ctx[5].error + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*errorInfo*/ 32) {
    				toggle_class(div5, "hidden", !/*errorInfo*/ ctx[5].show);
    			}

    			if (dirty & /*modalInfo*/ 64) {
    				toggle_class(div8, "is-active", /*modalInfo*/ ctx[6].show);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div9);
    			/*img_binding*/ ctx[14](null);
    			/*div9_binding*/ ctx[15](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Modal', slots, []);
    	let modalComponent;
    	let valiImg;
    	let inputValue = '';
    	let showLoading = false;
    	let files;
    	let usingURL = true;
    	let errorInfo = { show: false, error: '' };
    	const dispatch = createEventDispatcher();
    	let modalInfo = { show: false };
    	modalStore.set(modalInfo);

    	modalStore.subscribe(value => {
    		$$invalidate(6, modalInfo = value);
    	});

    	const errorCallback = () => {
    		// The URL is invalid, show an error message on the UI
    		$$invalidate(3, showLoading = false);

    		$$invalidate(5, errorInfo.show = true, errorInfo);

    		$$invalidate(
    			5,
    			errorInfo.error = usingURL
    			? "We can't find the image at that URL."
    			: "Not a valid image file.",
    			errorInfo
    		);
    	};

    	const loadCallback = () => {
    		// The URL is valid, but we are not sure if loading it to canvas would be
    		// blocked by crossOrigin setting. Try it here before dispatch to parent.
    		// https://stackoverflow.com/questions/13674835/canvas-tainted-by-cross-origin-data
    		let canvas = document.createElement("canvas");

    		let context = canvas.getContext("2d");
    		canvas.width = valiImg.width;
    		canvas.height = valiImg.height;
    		context.drawImage(valiImg, 0, 0);

    		try {
    			context.getImageData(0, 0, valiImg.width, valiImg.height);

    			// If the foreign image does support CORS -> use this image
    			// dispatch to parent component to use the input image
    			$$invalidate(3, showLoading = false);

    			$$invalidate(6, modalInfo.show = false, modalInfo);
    			modalStore.set(modalInfo);
    			dispatch('urlTyped', { url: valiImg.src });
    			$$invalidate(2, inputValue = null);
    		} catch(err) {
    			// If the foreign image does not support CORS -> use this image
    			$$invalidate(3, showLoading = false);

    			$$invalidate(5, errorInfo.show = true, errorInfo);
    			$$invalidate(5, errorInfo.error = "No permission to load this image.", errorInfo);
    		}
    	};

    	const imageUpload = () => {
    		usingURL = false;
    		let reader = new FileReader();

    		reader.onload = event => {
    			$$invalidate(1, valiImg.src = event.target.result, valiImg);
    		};

    		reader.readAsDataURL(files[0]);
    	};

    	const crossClicked = () => {
    		$$invalidate(6, modalInfo.show = false, modalInfo);
    		modalStore.set(modalInfo);

    		// Dispatch the parent component
    		dispatch('xClicked', { preImage: modalInfo.preImage });
    	};

    	const addClicked = () => {
    		// Validate the input URL
    		$$invalidate(3, showLoading = true);

    		$$invalidate(5, errorInfo.show = false, errorInfo);
    		$$invalidate(1, valiImg.crossOrigin = "Anonymous", valiImg);
    		$$invalidate(1, valiImg.src = inputValue, valiImg);
    	};

    	onMount(() => {
    		let modal = d3.select(modalComponent).select('#input-modal');
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		inputValue = this.value;
    		$$invalidate(2, inputValue);
    	}

    	function input1_change_handler() {
    		files = this.files;
    		$$invalidate(4, files);
    	}

    	function img_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			valiImg = $$value;
    			$$invalidate(1, valiImg);
    		});
    	}

    	function div9_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			modalComponent = $$value;
    			$$invalidate(0, modalComponent);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		createEventDispatcher,
    		modalStore,
    		modalComponent,
    		valiImg,
    		inputValue,
    		showLoading,
    		files,
    		usingURL,
    		errorInfo,
    		dispatch,
    		modalInfo,
    		errorCallback,
    		loadCallback,
    		imageUpload,
    		crossClicked,
    		addClicked
    	});

    	$$self.$inject_state = $$props => {
    		if ('modalComponent' in $$props) $$invalidate(0, modalComponent = $$props.modalComponent);
    		if ('valiImg' in $$props) $$invalidate(1, valiImg = $$props.valiImg);
    		if ('inputValue' in $$props) $$invalidate(2, inputValue = $$props.inputValue);
    		if ('showLoading' in $$props) $$invalidate(3, showLoading = $$props.showLoading);
    		if ('files' in $$props) $$invalidate(4, files = $$props.files);
    		if ('usingURL' in $$props) usingURL = $$props.usingURL;
    		if ('errorInfo' in $$props) $$invalidate(5, errorInfo = $$props.errorInfo);
    		if ('modalInfo' in $$props) $$invalidate(6, modalInfo = $$props.modalInfo);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		modalComponent,
    		valiImg,
    		inputValue,
    		showLoading,
    		files,
    		errorInfo,
    		modalInfo,
    		errorCallback,
    		loadCallback,
    		imageUpload,
    		crossClicked,
    		addClicked,
    		input0_input_handler,
    		input1_change_handler,
    		img_binding,
    		div9_binding
    	];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    function cubicInOut(t) {
        return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
    }

    var _ = {
      $(selector) {
        if (typeof selector === "string") {
          return document.querySelector(selector);
        }
        return selector;
      },
      extend(...args) {
        return Object.assign(...args);
      },
      cumulativeOffset(element) {
        let top = 0;
        let left = 0;

        do {
          top += element.offsetTop || 0;
          left += element.offsetLeft || 0;
          element = element.offsetParent;
        } while (element);

        return {
          top: top,
          left: left
        };
      },
      directScroll(element) {
        return element && element !== document && element !== document.body;
      },
      scrollTop(element, value) {
        let inSetter = value !== undefined;
        if (this.directScroll(element)) {
          return inSetter ? (element.scrollTop = value) : element.scrollTop;
        } else {
          return inSetter
            ? (document.documentElement.scrollTop = document.body.scrollTop = value)
            : window.pageYOffset ||
                document.documentElement.scrollTop ||
                document.body.scrollTop ||
                0;
        }
      },
      scrollLeft(element, value) {
        let inSetter = value !== undefined;
        if (this.directScroll(element)) {
          return inSetter ? (element.scrollLeft = value) : element.scrollLeft;
        } else {
          return inSetter
            ? (document.documentElement.scrollLeft = document.body.scrollLeft = value)
            : window.pageXOffset ||
                document.documentElement.scrollLeft ||
                document.body.scrollLeft ||
                0;
        }
      }
    };

    const defaultOptions = {
      container: "body",
      duration: 500,
      delay: 0,
      offset: 0,
      easing: cubicInOut,
      onStart: noop,
      onDone: noop,
      onAborting: noop,
      scrollX: false,
      scrollY: true
    };

    const _scrollTo = options => {
      let {
        offset,
        duration,
        delay,
        easing,
        x=0,
        y=0,
        scrollX,
        scrollY,
        onStart,
        onDone,
        container,
        onAborting,
        element
      } = options;

      if (typeof offset === "function") {
        offset = offset();
      }

      var cumulativeOffsetContainer = _.cumulativeOffset(container);
      var cumulativeOffsetTarget = element
        ? _.cumulativeOffset(element)
        : { top: y, left: x };

      var initialX = _.scrollLeft(container);
      var initialY = _.scrollTop(container);

      var targetX =
        cumulativeOffsetTarget.left - cumulativeOffsetContainer.left + offset;
      var targetY =
        cumulativeOffsetTarget.top - cumulativeOffsetContainer.top + offset;

      var diffX = targetX - initialX;
    	var diffY = targetY - initialY;

      let scrolling = true;
      let started = false;
      let start_time = now() + delay;
      let end_time = start_time + duration;

      function scrollToTopLeft(element, top, left) {
        if (scrollX) _.scrollLeft(element, left);
        if (scrollY) _.scrollTop(element, top);
      }

      function start(delayStart) {
        if (!delayStart) {
          started = true;
          onStart(element, {x, y});
        }
      }

      function tick(progress) {
        scrollToTopLeft(
          container,
          initialY + diffY * progress,
          initialX + diffX * progress
        );
      }

      function stop() {
        scrolling = false;
      }

      loop(now => {
        if (!started && now >= start_time) {
          start(false);
        }

        if (started && now >= end_time) {
          tick(1);
          stop();
          onDone(element, {x, y});
        }

        if (!scrolling) {
          onAborting(element, {x, y});
          return false;
        }
        if (started) {
          const p = now - start_time;
          const t = 0 + 1 * easing(p / duration);
          tick(t);
        }

        return true;
      });

      start(delay);

      tick(0);

      return stop;
    };

    const proceedOptions = options => {
    	let opts = _.extend({}, defaultOptions, options);
      opts.container = _.$(opts.container);
      opts.element = _.$(opts.element);
      return opts;
    };

    const scrollContainerHeight = containerElement => {
      if (
        containerElement &&
        containerElement !== document &&
        containerElement !== document.body
      ) {
        return containerElement.scrollHeight - containerElement.offsetHeight;
      } else {
        let body = document.body;
        let html = document.documentElement;

        return Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        );
      }
    };

    const setGlobalOptions = options => {
    	_.extend(defaultOptions, options || {});
    };

    const scrollTo = options => {
      return _scrollTo(proceedOptions(options));
    };

    const scrollToBottom = options => {
      options = proceedOptions(options);

      return _scrollTo(
        _.extend(options, {
          element: null,
          y: scrollContainerHeight(options.container)
        })
      );
    };

    const scrollToTop = options => {
      options = proceedOptions(options);

      return _scrollTo(
        _.extend(options, {
          element: null,
          y: 0
        })
      );
    };

    const makeScrollToAction = scrollToFunc => {
      return (node, options) => {
        let current = options;
        const handle = e => {
          e.preventDefault();
          scrollToFunc(
            typeof current === "string" ? { element: current } : current
          );
        };
        node.addEventListener("click", handle);
        node.addEventListener("touchstart", handle);
        return {
          update(options) {
            current = options;
          },
          destroy() {
            node.removeEventListener("click", handle);
            node.removeEventListener("touchstart", handle);
          }
        };
      };
    };

    const scrollto = makeScrollToAction(scrollTo);
    const scrolltotop = makeScrollToAction(scrollToTop);
    const scrolltobottom = makeScrollToAction(scrollToBottom);

    var animateScroll = /*#__PURE__*/Object.freeze({
        __proto__: null,
        setGlobalOptions: setGlobalOptions,
        scrollTo: scrollTo,
        scrollToBottom: scrollToBottom,
        scrollToTop: scrollToTop,
        makeScrollToAction: makeScrollToAction,
        scrollto: scrollto,
        scrolltotop: scrolltotop,
        scrolltobottom: scrolltobottom
    });

    /* src\article\Article.svelte generated by Svelte v3.47.0 */
    const file$a = "src\\article\\Article.svelte";

    function create_fragment$a(ctx) {
    	let div9;
    	let div8;
    	let article;
    	let h2;
    	let t1;
    	let p0;
    	let t3;
    	let div7;
    	let p1;
    	let t5;
    	let p2;
    	let t7;
    	let p3;
    	let t9;
    	let p4;
    	let t11;
    	let p5;
    	let t13;
    	let p6;
    	let t15;
    	let h30;
    	let t17;
    	let p7;
    	let t19;
    	let div1;
    	let img0;
    	let img0_src_value;
    	let t20;
    	let div0;
    	let t22;
    	let p8;
    	let t24;
    	let p9;
    	let t26;
    	let div3;
    	let img1;
    	let img1_src_value;
    	let t27;
    	let div2;
    	let t29;
    	let p10;
    	let t30;
    	let a;
    	let t32;
    	let t33;
    	let div4;
    	let button;
    	let span0;
    	let i;
    	let t34;
    	let span1;
    	let t36;
    	let p11;
    	let t38;
    	let p12;
    	let t40;
    	let h31;
    	let t42;
    	let p13;
    	let t44;
    	let p14;
    	let t46;
    	let p15;
    	let t48;
    	let p16;
    	let t50;
    	let p17;
    	let t52;
    	let p18;
    	let t54;
    	let p19;
    	let t56;
    	let p20;
    	let t58;
    	let h32;
    	let t60;
    	let p21;
    	let t62;
    	let div6;
    	let img2;
    	let img2_src_value;
    	let t63;
    	let div5;
    	let t65;
    	let p22;
    	let t67;
    	let p23;
    	let t69;
    	let p24;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			div8 = element("div");
    			article = element("article");
    			h2 = element("h2");
    			h2.textContent = "DataTrainX c'est quoi ?";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Outil de recherche des singularités cognitives d’un étudiant!";
    			t3 = space();
    			div7 = element("div");
    			p1 = element("p");
    			p1.textContent = "Dans l’apprentissage, une logique de la restitution qui prévaut encore sur une logique de la compréhension serait à l’origine de nombreux échecs de l’apprenant. Pour se comprendre, comprendre le monde et autrui, tout apprenant produit et met en œuvre des ressources métacognitives.";
    			t5 = space();
    			p2 = element("p");
    			p2.textContent = "On observera que cela fait appel à de nombreuses disciplines, comme la psychologie, la pédagogie, les neurosciences mais aussi le management, qui demandera à l’équipe enseignante une formation continue pour s’appuyer sur de tels dispositifs.";
    			t7 = space();
    			p3 = element("p");
    			p3.textContent = "DataTrainX est un prototype de reconnaissance facial des émotions (REF) qui a pour objectif principal de s’intéresser à l’analyse des comportements de l'apprenant dans un but de neuropédagogie.";
    			t9 = space();
    			p4 = element("p");
    			p4.textContent = "Cela peut être très utile dans l'adaptation des modèles d’apprentissage où, en analysant les comportements, on serait en mesure de s’adapter à l’apprenant (adaptive-learning).";
    			t11 = space();
    			p5 = element("p");
    			p5.textContent = "DataTrainX est un agent intelligent capable de reconnaître les émotions traduites par les expressions faciales couplées au test de Kolb sur le style d’apprentissage.";
    			t13 = space();
    			p6 = element("p");
    			p6.textContent = "Pour ce faire, nous utiliserons des algorithmes de deep-Learning et plus particulièrement les réseaux de neurones convolutifs (CNN) dans la reconnaissance des émotions de bases défini par le psychologue P. Ekman ('Colère', 'Dégoût', 'Peur', 'Joyeux', 'Triste', 'Surprise', 'Neutre').";
    			t15 = space();
    			h30 = element("h3");
    			h30.textContent = "Principe d'un réseau de neurones convolutifs - Deep Learning";
    			t17 = space();
    			p7 = element("p");
    			p7.textContent = "Les réseaux de neurones convolutifs ont une méthodologie similaire à celle des méthodes traditionnelles d'apprentissage supervisé, ils détectent les caractéristiques, puis entraînent un classifieur dessus, à la différence près que les caractéristiques sont apprises automatiquement. Un CNN applique généralement 5 types de couches différentes à une image afin d’en extraire les informations pertinentes, la couche de convolution, la couche de pooling, la couche de correction ReLU et la couche fully-connected (figure 1).";
    			t19 = space();
    			div1 = element("div");
    			img0 = element("img");
    			t20 = space();
    			div0 = element("div");
    			div0.textContent = "Figure 1. Principe d'une architecture CNN";
    			t22 = space();
    			p8 = element("p");
    			p8.textContent = "La couche de convolution permet de trouver des caractéristiques, elle est donc la composante la plus importante. Elle est assez proche de la mécanique sur les caractéristiques pseudo-Haar. Le principe est le même, faire \"glisser\" une fenêtre représentant un filtre sur l'image. La différence ici, c’est que l’on cherche une convolution calculée et non une corrélation croisée (comme la recherche d’une caractéristiques pseudo-haar).";
    			t24 = space();
    			p9 = element("p");
    			p9.textContent = "Le filtre, sera la caractéristique à étudier, cette caractéristique est trouvée par convolution, pour comprendre l’application nous simplifions l’image du visage par une croix noirs et blanche (figure 2). La caractéristique (feature) dans cet exemple prend la taille de 3x3 puis recherche des points communs par balayage de l’image. Dans la démonstration nous avons pris la valeur d’un pixel en 2D, 1 pour blanc et -1 pour noir, ainsi entre deux caractéristiques comparées nous réalisons un calcul d’addition entre les 9 pixels ce qui nous permet d’obtenir un score de similarité, ici 80%. Ce même calcul est réalisé sur l’ensemble  de l’image avec un stride de 1 (la zone comparée bouge d’un seul pixel entre chaque comparaison).";
    			t26 = space();
    			div3 = element("div");
    			img1 = element("img");
    			t27 = space();
    			div2 = element("div");
    			div2.textContent = "Figure 2. Principe de convolution est de l'activation ReLU, ici la comparaison entre les deux images permettent de trouver trois caractéristiques, l'une des caractéristiques (en vert) est nettoyer ensuite des valeurs négatives (ReLU)";
    			t29 = space();
    			p10 = element("p");
    			t30 = text("Nous avons adaptés le projet ");
    			a = element("a");
    			a.textContent = "CNN Explainer";
    			t32 = text(" pour en comprendre le principe sur un dataset fer2013.");
    			t33 = space();
    			div4 = element("div");
    			button = element("button");
    			span0 = element("span");
    			i = element("i");
    			t34 = space();
    			span1 = element("span");
    			span1.textContent = "Comment ça marche ?";
    			t36 = space();
    			p11 = element("p");
    			p11.textContent = "L’idée est de se concentrer sur la démarche que privilégie chaque individu pour appréhender l’acte d’apprendre. Certains styles seraient plus adaptés dans certains contextes que d’autres. Tout dépend du point de vue de l’apprenant face à la situation d’apprentissage et de sa motivation.";
    			t38 = space();
    			p12 = element("p");
    			p12.textContent = "Bien que des auteurs comme Jean Houssaye démontrent que ce qui semble essentiel c’est de différencier la pédagogie bien plus que des typologies destinées à connaître individuellement les apprenants et à dresser leur profil, il parait néanmoins intéressant de les utiliser comme complémentarité à un panel d’outil diversifié que peut utiliser le formateur.";
    			t40 = space();
    			h31 = element("h3");
    			h31.textContent = "Le modèle de l’apprentissage expérientiel de Kolb";
    			t42 = space();
    			p13 = element("p");
    			p13.textContent = "Les modèles de styles d’apprentissage individualisés ont donc pour objectif de définir un type d’apprenant afin de permettre aux enseignants d’adapter leurs méthodes d’apprentissage. Peu d’études ont réussi à valider le concept de styles d’apprentissage en éducation.";
    			t44 = space();
    			p14 = element("p");
    			p14.textContent = "Peu d’études ont réussi à valider le concept de styles d’apprentissage en éducation. L’étude de Pashler et al indique bien une corrélation entre typologies et les préférences exprimées par certains individus sur la façon dont ils préfèrent recevoir de l’information mais contredit le fait selon laquelle l’apprenant apprendrait mieux en apprenant avec une méthode jugée comme appropriée à son style d’apprentissage";
    			t46 = space();
    			p15 = element("p");
    			p15.textContent = "Nombreux sont les scientifiques qui parle de mythe ou invitent les professionnels de l’éducation et d’apprentissage à faire preuve de scepticisme devant ces concepts. Le modèle de Kolb n’échappe pas non plus aux critiques mais il est de loin celui qui a connu la plus large diffusion et celui qui est à la base de modèle d’autres chercheurs.";
    			t48 = space();
    			p16 = element("p");
    			p16.textContent = "Il est inspiré des travaux de psychologue reconnu comme John Dewey, Kurt Lewin et Jean Piaget. Il est plutôt approprié pour les apprentissages de disciplines académiques relativement abstraites, mais moins adaptés pour la plupart des apprentissages professionnels.";
    			t50 = space();
    			p17 = element("p");
    			p17.textContent = "D’un autre côté, notre cible d’étude est réalisée sur des universitaires en informatique, ce test nous semble donc plutôt approprié.";
    			t52 = space();
    			p18 = element("p");
    			p18.textContent = "Ce qu’il faut retenir des principales critiques, c’est qu’étiqueter un apprenant et le cantonner dans une posture est strictement contre-productif et va à l’inverse de l’objectif recherché. Néanmoins, ce qu’il ressort aussi, ce sont des concepts génériques qui fonctionnent.";
    			t54 = space();
    			p19 = element("p");
    			p19.textContent = "Par exemple, un profil « indépendants » a tendance à questionner les novices alors que le profil « socialisant » propose des aides, les « socialisants » s’adaptent à leur interlocuteur, quel que soit le style du novice, ceux qui travaillent avec un expert « socialisant » progressent le plus.";
    			t56 = space();
    			p20 = element("p");
    			p20.textContent = "On peut donc constater que les styles d’apprentissage, nous ouvre une voie pour des recherches sur les interactions sociales entre formateurs et apprenants. Pour des raisons à la fois pratiques et théoriques, il faut retenir la « maniabilité » des styles mais que cependant ils paraissent suffisamment stables pour qu’on puisse les prendre en compte dans une situation donnée afin de contribuer à expliquer ses comportements d’apprentissage. Puis enfin, garder à l’esprit qu’en modifiant de façon significative la situation d’apprentissage, il est possible qu’un individu modifie son style préférentiel d’apprentissage. Enfin, le facteur que l’on souhaite ajouter à notre projet et l’expression de l’émotion corrélé au type d’apprentissage.";
    			t58 = space();
    			h32 = element("h3");
    			h32.textContent = "Typologie d’apprentissage et émotions";
    			t60 = space();
    			p21 = element("p");
    			p21.textContent = "Il y aura donc une phase de saisie d’un questionnaire afin de déterminer un profil d’apprenant de type Kolb dans le projet DataTrainx. L’utilisateur sera enregistré en vidéo et une comparaison sera effectuée entre la typologie trouvée par le questionnaire et les émotions qu’il aura exprimées. Comme l’illustre la figure ci-dessous, l’objectif est de trouver une corrélation entre la typologie d’apprentissage et l’émotion de l’utilisateur.";
    			t62 = space();
    			div6 = element("div");
    			img2 = element("img");
    			t63 = space();
    			div5 = element("div");
    			div5.textContent = "Figure 3. Exemple de restitution des résultats de l’application DataTrainX. Obtenir un profil d’apprenant, analyser l’émotion dans une mise en situation, trouver une corrélation.";
    			t65 = space();
    			p22 = element("p");
    			p22.textContent = "Dans l’hypothèse où nous aurions des résultats significatifs entre expression et typologie, nous pourrions considérer que le profil émotionnel même de l’émotion détermine la typologie d’apprentissage et donc envisager, par exemple, une orientation du logiciel vers l’adaptative learning, c’est-à-dire une interaction entre l’IA et l’utilisateur dans la proposition des supports pédagogique.";
    			t67 = space();
    			p23 = element("p");
    			p23.textContent = "L’objet de ce projet, a pour orientation de se focaliser concrètement sur les moyens fonctionnels informatique à mettre en œuvre pour ce type d’application. Nous n’approfondirons pas l’aspect psychologique, qui se limitera au test de Kolb et à la résolution d’un Puzzle, l’objectif étant de démontrer comment mettre en place l’architecture fonctionnelle, logicielle et matérielle pour arriver à un résultat applicatif de la reconnaissance faciale de l’émotion.";
    			t69 = space();
    			p24 = element("p");
    			p24.textContent = "Les résultats d’ordre psychologique à prendre en considération sur l’objectif de cette application auront donc une part importante de subjectivité clairement assumé.";
    			attr_dev(h2, "class", "title");
    			add_location(h2, file$a, 29, 12, 588);
    			attr_dev(p0, "class", "subtitle");
    			add_location(p0, file$a, 30, 12, 647);
    			add_location(p1, file$a, 32, 16, 783);
    			add_location(p2, file$a, 33, 16, 1088);
    			add_location(p3, file$a, 34, 16, 1353);
    			add_location(p4, file$a, 35, 16, 1570);
    			add_location(p5, file$a, 36, 16, 1769);
    			add_location(p6, file$a, 37, 16, 1958);
    			add_location(h30, file$a, 38, 16, 2265);
    			add_location(p7, file$a, 39, 16, 2351);
    			if (!src_url_equal(img0.src, img0_src_value = "/assets/figures/cnn.gif")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "Principe d'une architecture CNN");
    			add_location(img0, file$a, 41, 20, 2937);
    			attr_dev(div0, "class", "figure-caption svelte-11k33wl");
    			add_location(div0, file$a, 42, 20, 3043);
    			attr_dev(div1, "class", "figure svelte-11k33wl");
    			add_location(div1, file$a, 40, 16, 2896);
    			add_location(p8, file$a, 46, 16, 3204);
    			add_location(p9, file$a, 47, 16, 3660);
    			if (!src_url_equal(img1.src, img1_src_value = "/assets/figures/relu.gif")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "Principe de convolution est de l'activation ReLU");
    			add_location(img1, file$a, 49, 20, 4455);
    			attr_dev(div2, "class", "figure-caption svelte-11k33wl");
    			add_location(div2, file$a, 50, 20, 4579);
    			attr_dev(div3, "class", "figure svelte-11k33wl");
    			add_location(div3, file$a, 48, 16, 4414);
    			attr_dev(a, "href", "https://poloclub.github.io/cnn-explainer/");
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$a, 54, 48, 4964);
    			add_location(p10, file$a, 54, 16, 4932);
    			attr_dev(i, "class", "fas fa-eye");
    			add_location(i, file$a, 59, 30, 5427);
    			attr_dev(span0, "class", "icon");
    			add_location(span0, file$a, 58, 28, 5377);
    			add_location(span1, file$a, 61, 24, 5514);
    			attr_dev(button, "class", "button is-primary");
    			attr_dev(button, "id", "explain-button");
    			add_location(button, file$a, 57, 20, 5168);
    			attr_dev(div4, "class", "buttons");
    			add_location(div4, file$a, 55, 16, 5125);
    			add_location(p11, file$a, 64, 16, 5616);
    			add_location(p12, file$a, 65, 16, 5927);
    			add_location(h31, file$a, 66, 16, 6306);
    			add_location(p13, file$a, 67, 16, 6381);
    			add_location(p14, file$a, 68, 16, 6672);
    			add_location(p15, file$a, 69, 16, 7110);
    			add_location(p16, file$a, 70, 16, 7475);
    			add_location(p17, file$a, 71, 16, 7763);
    			add_location(p18, file$a, 72, 16, 7919);
    			add_location(p19, file$a, 73, 16, 8217);
    			add_location(p20, file$a, 74, 16, 8533);
    			add_location(h32, file$a, 75, 16, 9297);
    			add_location(p21, file$a, 76, 16, 9360);
    			if (!src_url_equal(img2.src, img2_src_value = "/assets/figures/style.gif")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "Exemple de restitution des résultats de l’application DataTrainX.");
    			add_location(img2, file$a, 78, 20, 9865);
    			attr_dev(div5, "class", "figure-caption svelte-11k33wl");
    			add_location(div5, file$a, 79, 20, 10007);
    			attr_dev(div6, "class", "figure svelte-11k33wl");
    			add_location(div6, file$a, 77, 16, 9824);
    			add_location(p22, file$a, 83, 16, 10305);
    			add_location(p23, file$a, 84, 16, 10719);
    			add_location(p24, file$a, 85, 16, 11203);
    			attr_dev(div7, "class", "content");
    			add_location(div7, file$a, 31, 12, 745);
    			attr_dev(article, "class", "tile is-child");
    			add_location(article, file$a, 28, 8, 544);
    			attr_dev(div8, "class", "tile is-parent");
    			add_location(div8, file$a, 27, 4, 507);
    			attr_dev(div9, "class", "container");
    			add_location(div9, file$a, 26, 0, 479);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div9, anchor);
    			append_dev(div9, div8);
    			append_dev(div8, article);
    			append_dev(article, h2);
    			append_dev(article, t1);
    			append_dev(article, p0);
    			append_dev(article, t3);
    			append_dev(article, div7);
    			append_dev(div7, p1);
    			append_dev(div7, t5);
    			append_dev(div7, p2);
    			append_dev(div7, t7);
    			append_dev(div7, p3);
    			append_dev(div7, t9);
    			append_dev(div7, p4);
    			append_dev(div7, t11);
    			append_dev(div7, p5);
    			append_dev(div7, t13);
    			append_dev(div7, p6);
    			append_dev(div7, t15);
    			append_dev(div7, h30);
    			append_dev(div7, t17);
    			append_dev(div7, p7);
    			append_dev(div7, t19);
    			append_dev(div7, div1);
    			append_dev(div1, img0);
    			append_dev(div1, t20);
    			append_dev(div1, div0);
    			append_dev(div7, t22);
    			append_dev(div7, p8);
    			append_dev(div7, t24);
    			append_dev(div7, p9);
    			append_dev(div7, t26);
    			append_dev(div7, div3);
    			append_dev(div3, img1);
    			append_dev(div3, t27);
    			append_dev(div3, div2);
    			append_dev(div7, t29);
    			append_dev(div7, p10);
    			append_dev(p10, t30);
    			append_dev(p10, a);
    			append_dev(p10, t32);
    			append_dev(div7, t33);
    			append_dev(div7, div4);
    			append_dev(div4, button);
    			append_dev(button, span0);
    			append_dev(span0, i);
    			append_dev(button, t34);
    			append_dev(button, span1);
    			append_dev(div7, t36);
    			append_dev(div7, p11);
    			append_dev(div7, t38);
    			append_dev(div7, p12);
    			append_dev(div7, t40);
    			append_dev(div7, h31);
    			append_dev(div7, t42);
    			append_dev(div7, p13);
    			append_dev(div7, t44);
    			append_dev(div7, p14);
    			append_dev(div7, t46);
    			append_dev(div7, p15);
    			append_dev(div7, t48);
    			append_dev(div7, p16);
    			append_dev(div7, t50);
    			append_dev(div7, p17);
    			append_dev(div7, t52);
    			append_dev(div7, p18);
    			append_dev(div7, t54);
    			append_dev(div7, p19);
    			append_dev(div7, t56);
    			append_dev(div7, p20);
    			append_dev(div7, t58);
    			append_dev(div7, h32);
    			append_dev(div7, t60);
    			append_dev(div7, p21);
    			append_dev(div7, t62);
    			append_dev(div7, div6);
    			append_dev(div6, img2);
    			append_dev(div6, t63);
    			append_dev(div6, div5);
    			append_dev(div7, t65);
    			append_dev(div7, p22);
    			append_dev(div7, t67);
    			append_dev(div7, p23);
    			append_dev(div7, t69);
    			append_dev(div7, p24);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[0], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div9);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Article', slots, []);
    	let leftStartValue;

    	leftStartStore.subscribe(value => {
    		leftStartValue = value;
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Article> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => scrollTo({
    		element: "#header",
    		onDone: (element, offset) => {
    			leftStartStore.set(-innerWidth);
    		}
    	});

    	$$self.$capture_state = () => ({
    		animateScroll,
    		leftStartStore,
    		leftStartValue
    	});

    	$$self.$inject_state = $$props => {
    		if ('leftStartValue' in $$props) leftStartValue = $$props.leftStartValue;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [click_handler];
    }

    class Article extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Article",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* global tf */

    // Network input image size
    const networkInputSize = 48;

    //mode RGB = 3, Gray = 1
    const inputShape = 1;

    // Enum of node types
    const nodeType = {
      INPUT: 'input',
      CONV: 'conv',
      POOL: 'pool',
      RELU: 'relu',
      FC: 'fc',
      FLATTEN: 'flatten'
    };

    class Node {
      /**
       * Class structure for each neuron node.
       *
       * @param {string} layerName Name of the node's layer.
       * @param {int} index Index of this node in its layer.
       * @param {string} type Node type {input, conv, pool, relu, fc}.
       * @param {number} bias The bias assocated to this node.
       * @param {number[]} output Output of this node.
       */
      constructor(layerName, index, type, bias, output) {
        this.layerName = layerName;
        this.index = index;
        this.type = type;
        this.bias = bias;
        this.output = output;

        // Weights are stored in the links
        this.inputLinks = [];
        this.outputLinks = [];
      }
    }

    class Link {
      /**
       * Class structure for each link between two nodes.
       *
       * @param {Node} source Source node.
       * @param {Node} dest Target node.
       * @param {number} weight Weight associated to this link. It can be a number,
       *  1D array, or 2D array.
       */
      constructor(source, dest, weight) {
        this.source = source;
        this.dest = dest;
        this.weight = weight;
      }
    }

    /**
     * Construct a CNN with given extracted outputs from every layer.
     *
     * @param {number[][]} allOutputs Array of outputs for each layer.
     *  allOutputs[i][j] is the output for layer i node j.
     * @param {Model} model Loaded tf.js model.
     * @param {Tensor} inputImageTensor Loaded input image tensor.
     */
    const constructCNNFromOutputs = (allOutputs, model, inputImageTensor) => {
      let cnn = [];
      // Add the first layer (input layer)
      let inputLayer = [];
      let inputShape = model.layers[0].batchInputShape.slice(1);
      let inputImageArray = inputImageTensor.transpose([2, 0, 1]).arraySync();

      // First layer's three nodes' outputs are the channels of inputImageArray
      for (let i = 0; i < inputShape[2]; i++) {
        let node = new Node('input', i, nodeType.INPUT, 0, inputImageArray[i]);
        inputLayer.push(node);
      }

      cnn.push(inputLayer);
      let curLayerIndex = 1;
      for (let l = 0; l < model.layers.length; l++) {
        let layer = model.layers[l];
        // Get the current output
        let outputs = allOutputs[l].squeeze();
        outputs = outputs.arraySync();

        let curLayerNodes = [];
        let curLayerType;

        console.log("name >> " + layer.name);
        // Identify layer type based on the layer name
        if (layer.name.includes('conv')) {
          curLayerType = nodeType.CONV;
        } else if (layer.name.includes('pool')) {
          curLayerType = nodeType.POOL;
        } else if (layer.name.includes('relu')) {
          curLayerType = nodeType.RELU;
        } else if (layer.name.includes('output')) {
          curLayerType = nodeType.FC;
        } else if (layer.name.includes('flatten')) {
          curLayerType = nodeType.FLATTEN;
        } else if (layer.name.includes('batch')) ; else if (layer.name.includes('dropout')) ; else if (layer.name.includes('dense')) ; else if (layer.name.includes('activation')) ; else {
          console.log('Find unknown type');
        }

        //ignore if layer is undefined
        if(curLayerType){

          // Construct this layer based on its layer type
          switch (curLayerType) {
            case nodeType.CONV: {
              let biases = layer.bias.val.arraySync();
              // The new order is [output_depth, input_depth, height, width]
              let weights = layer.kernel.val.transpose([3, 2, 0, 1]).arraySync();

              // Add nodes into this layer
              for (let i = 0; i < outputs.length; i++) {
                let node = new Node(layer.name, i, curLayerType, biases[i],
                    outputs[i]);

                // Connect this node to all previous nodes (create links)
                // CONV layers have weights in links. Links are one-to-multiple.
                for (let j = 0; j < cnn[curLayerIndex - 1].length; j++) {
                  let preNode = cnn[curLayerIndex - 1][j];
                  let curLink = new Link(preNode, node, weights[i][j]);
                  preNode.outputLinks.push(curLink);
                  node.inputLinks.push(curLink);
                }
                curLayerNodes.push(node);
              }
              break;
            }
            case nodeType.FC: {
              let biases = layer.bias.val.arraySync();
              // The new order is [output_depth, input_depth]
              let weights = layer.kernel.val.transpose([1, 0]).arraySync();

              // Add nodes into this layer
              for (let i = 0; i < outputs.length; i++) {
                let node = new Node(layer.name, i, curLayerType, biases[i],
                    outputs[i]);

                // Connect this node to all previous nodes (create links)
                // FC layers have weights in links. Links are one-to-multiple.

                // Since we are visualizing the logit values, we need to track
                // the raw value before softmax
                let curLogit = 0;
                for (let j = 0; j < cnn[curLayerIndex - 1].length; j++) {
                  let preNode = cnn[curLayerIndex - 1][j];
                  let curLink = new Link(preNode, node, weights[i][j]);
                  preNode.outputLinks.push(curLink);
                  node.inputLinks.push(curLink);
                  curLogit += preNode.output * weights[i][j];
                }
                curLogit += biases[i];
                node.logit = curLogit;
                curLayerNodes.push(node);
              }

              // Sort flatten layer based on the node TF index
              cnn[curLayerIndex - 1].sort((a, b) => a.realIndex - b.realIndex);
              break;
            }
            case nodeType.RELU:
            case nodeType.POOL: {
              // RELU and POOL have no bias nor weight
              let bias = 0;
              let weight = null;

              // Add nodes into this layer
              for (let i = 0; i < outputs.length; i++) {
                let node = new Node(layer.name, i, curLayerType, bias, outputs[i]);

                // RELU and POOL layers have no weights. Links are one-to-one
                let preNode = cnn[curLayerIndex - 1][i];
                let link = new Link(preNode, node, weight);
                preNode.outputLinks.push(link);
                node.inputLinks.push(link);
                curLayerNodes.push(node);
              }
              break;
            }
            case nodeType.FLATTEN: {
              // Flatten layer has no bias nor weights.
              let bias = 0;

              for (let i = 0; i < outputs.length; i++) {
                // Flatten layer has no weights. Links are multiple-to-one.
                // Use dummy weights to store the corresponding entry in the previsou
                // node as (row, column)
                // The flatten() in tf2.keras has order: channel -> row -> column
                let preNodeWidth = cnn[curLayerIndex - 1][0].output.length,
                    preNodeNum = cnn[curLayerIndex - 1].length,
                    preNodeIndex = i % preNodeNum,
                    preNodeRow = Math.floor(Math.floor(i / preNodeNum) / preNodeWidth),
                    preNodeCol = Math.floor(i / preNodeNum) % preNodeWidth,
                    // Use channel, row, colume to compute the real index with order
                    // row -> column -> channel
                    curNodeRealIndex = preNodeIndex * (preNodeWidth * preNodeWidth) +
                        preNodeRow * preNodeWidth + preNodeCol;

                let node = new Node(layer.name, i, curLayerType,
                    bias, outputs[i]);

                // TF uses the (i) index for computation, but the real order should
                // be (curNodeRealIndex). We will sort the nodes using the real order
                // after we compute the logits in the output layer.
                node.realIndex = curNodeRealIndex;

                let link = new Link(cnn[curLayerIndex - 1][preNodeIndex],
                    node, [preNodeRow, preNodeCol]);

                cnn[curLayerIndex - 1][preNodeIndex].outputLinks.push(link);
                node.inputLinks.push(link);

                curLayerNodes.push(node);
              }

              // Sort flatten layer based on the node TF index
              curLayerNodes.sort((a, b) => a.index - b.index);
              break;
            }
            default:
              console.error('Encounter unknown layer type');
              break;
          }

          // Add current layer to the NN
          cnn.push(curLayerNodes);
          curLayerIndex++;
        }
      }
      return cnn;
    };

    /**
     * Construct a CNN with given model and input.
     *
     * @param {string} inputImageFile filename of input image.
     * @param {Model} model Loaded tf.js model.
     */
    const constructCNN = async (inputImageFile, model) => {

      // Load the image file
      let inputImageTensor = await getInputImageArray(inputImageFile, true);
      console.log(inputImageTensor);
      // Need to feed the model with a batch
      let inputImageTensorBatch = tf.stack([inputImageTensor]);

      // To get intermediate layer outputs, we will iterate through all layers in
      // the model, and sequencially apply transformations.
      let preTensor = inputImageTensorBatch;
      let outputs = [];
      // Iterate through all layers, and build one model with that layer as output
      for (let l = 0; l < model.layers.length; l++) {
        let curTensor = model.layers[l].apply(preTensor);
        // Record the output tensor
        // Because there is only one element in the batch, we use squeeze()
        // We also want to use CHW order here

        let output = curTensor.squeeze();
        if (output.shape.length === 3) {
          output = output.transpose([2, 0, 1]);
        }
        outputs.push(output);

        // Update preTensor for next nesting iteration
        preTensor = curTensor;
      }

      let cnn = constructCNNFromOutputs(outputs, model, inputImageTensor);
      return cnn;
    };

    // Helper functions

    /**
     * Crop the largest central square of size 64x64x3 of a 3d array.
     *
     * @param {[int8]} arr array that requires cropping and padding (if a 64x64 crop
     * is not present)
     * @returns 64x64x3 array
     */
    const cropCentralSquare = (arr) => {
      let width = arr.length;
      let height = arr[0].length;
      let croppedArray;

      // Crop largest square from image if the image is smaller than 64x64 and pad the
      // cropped image.
      if (width < networkInputSize || height < networkInputSize) {
        // TODO(robert): Finish the padding logic.  Pushing now for Omar to work on when he is ready.
        let cropDimensions = Math.min(width, height);
        let startXIdx = Math.floor(width / 2) - (cropDimensions / 2);
        let startYIdx = Math.floor(height / 2) - (cropDimensions / 2);
        let unpaddedSubarray = arr.slice(startXIdx, startXIdx + cropDimensions).map(i => i.slice(startYIdx, startYIdx + cropDimensions));
      } else {
        let startXIdx = Math.floor(width / 2) - Math.floor(networkInputSize / 2);
        let startYIdx = Math.floor(height / 2) - Math.floor(networkInputSize / 2);
        croppedArray = arr.slice(startXIdx, startXIdx + networkInputSize).map(i => i.slice(startYIdx, startYIdx + networkInputSize));
      }
      return croppedArray;
    };

    /**
     * Convert canvas image data into a 3D tensor with dimension [height, width, 3].
     * Recall that tensorflow uses NHWC order (batch, height, width, channel).
     * Each pixel is in 0-255 scale.
     *
     * @param {[int8]} imageData Canvas image data
     * @param {int} width Canvas image width
     * @param {int} height Canvas image height
     */
    const imageDataTo3DTensor = (imageData, width, height, normalize=true) => {
      // Create array placeholder for the 3d array [width, height, 3] for rgb
      let imageArray = tf.fill([width, height, inputShape], 0).arraySync();

      // Iterate through the data to fill out channel arrays above
      for (let i = 0; i < imageData.length; i++) {
        let pixelIndex = Math.floor(i / 4),
            channelIndex = i % 4,
            row = width === height ? Math.floor(pixelIndex / width)
                : pixelIndex % width,
            column = width === height ? pixelIndex % width
                : Math.floor(pixelIndex / width);

        if (channelIndex < inputShape) {
          let curEntry  = imageData[i];
          // Normalize the original pixel value from [0, 255] to [0, 1]
          if (normalize) {
            curEntry /= 255;
          }
          imageArray[row][column][channelIndex] = curEntry;
        }
      }

      // If the image is not 64x64, crop and or pad the image appropriately.
      if (width != networkInputSize && height != networkInputSize) {
        imageArray = cropCentralSquare(imageArray);
      }

      let tensor = tf.tensor3d(imageArray);
      return tensor;
    };

    /**
     * Get the 3D pixel value array of the given image file.
     *
     * @param {string} imgFile File path to the image file
     * @returns A promise with the corresponding 3D array
     */
    const getInputImageArray = (imgFile, normalize=true) => {
      let canvas = document.createElement('canvas');
      canvas.style.cssText = 'display:none;';
      document.getElementsByTagName('body')[0].appendChild(canvas);
      let context = canvas.getContext('2d');

      return new Promise((resolve, reject) => {
        let inputImage = new Image();
        inputImage.crossOrigin = "Anonymous";
        inputImage.src = imgFile;
        let canvasImage;
        inputImage.onload = () => {
          canvas.width = inputImage.width;
          canvas.height = inputImage.height;
          // Resize the input image of the network if it is too large to simply crop
          // the center 64x64 portion in order to still provide a representative
          // input image into the network.
          if (inputImage.width > networkInputSize || inputImage.height > networkInputSize) {
            // Step 1 - Resize using smaller dimension to scale the image down. 
            let resizeCanvas = document.createElement('canvas'),
                resizeContext = resizeCanvas.getContext('2d');
            let smallerDimension = Math.min(inputImage.width, inputImage.height);
            const resizeFactor = (networkInputSize + 1) / smallerDimension;
            resizeCanvas.width = inputImage.width * resizeFactor;
            resizeCanvas.height = inputImage.height * resizeFactor;
            resizeContext.drawImage(inputImage, 0, 0, resizeCanvas.width,
                resizeCanvas.height);

            // Step 2 - Flip non-square images horizontally and rotate them 90deg since
            // non-square images are not stored upright.
            if (inputImage.width != inputImage.height) {
              context.translate(resizeCanvas.width, 0);
              context.scale(-1, 1);
              context.translate(resizeCanvas.width / 2, resizeCanvas.height / 2);
              context.rotate(90 * Math.PI / 180);
            }

            // Step 3 - Draw resized image on original canvas.
            if (inputImage.width != inputImage.height) {
              context.drawImage(resizeCanvas, -resizeCanvas.width / 2, -resizeCanvas.height / 2);
            } else {
              context.drawImage(resizeCanvas, 0, 0);
            }
            canvasImage = context.getImageData(0, 0, resizeCanvas.width,
                resizeCanvas.height);

          } else {
            context.drawImage(inputImage, 0, 0);
            canvasImage = context.getImageData(0, 0, inputImage.width,
                inputImage.height);
          }
          // Get image data and convert it to a 3D array
          let imageData = canvasImage.data;
          let imageWidth = canvasImage.width;
          let imageHeight = canvasImage.height;

          // Remove this newly created canvas element
          canvas.parentNode.removeChild(canvas);

          resolve(imageDataTo3DTensor(imageData, imageWidth, imageHeight, normalize));
        };
        inputImage.onerror = reject;
      })
    };

    /**
     * Wrapper to load a model.
     *
     * @param {string} modelFile Filename of converted (through tensorflowjs.py)
     *  model json file.
     */
    const loadTrainedModel = (modelFile) => {
      return tf.loadLayersModel(modelFile);
    };

    /* global d3 */

    const layerColorScales$1 = {
      input: [d3.interpolateGreys, d3.interpolateGreys, d3.interpolateGreys],
      conv: d3.interpolateRdBu,
      relu: d3.interpolateRdBu,
      pool: d3.interpolateRdBu,
      fc: d3.interpolateGreys,
      weight: d3.interpolateBrBG,
      logit: d3.interpolateOranges
    };

    let nodeLength = 40;

    const overviewConfig = {
      nodeLength : nodeLength,
      plusSymbolRadius : nodeLength / 5,
      numLayers : 12,
      edgeOpacity : 0.8,
      edgeInitColor : 'rgb(230, 230, 230)',
      edgeHoverColor : 'rgb(130, 130, 130)',
      edgeHoverOuting : false,
      edgeStrokeWidth : 0.7,
      intermediateColor : 'gray',
      layerColorScales: layerColorScales$1,
      svgPaddings: {top: 25, bottom: 25, left: 50, right: 50},
      kernelRectLength: 8/3,
      gapRatio: 4,
      modeImg: 1, // 1 for gray or 3 rgb
      overlayRectOffset: 12,
      classLists: ['Colère', 'Dégoût', 'Peur', 'Joyeux', 'Triste', 'Surprise', 'Neutre']
    };

    // Configs
    const nodeLength$1 = overviewConfig.nodeLength;

    /**
     * Compute the [minimum, maximum] of a 1D or 2D array.
     * @param {[number]} array 
     */
    const getExtent = (array) => {
      let min = Infinity;
      let max = -Infinity;

      // Scalar
      if (array.length === undefined) {
        return [array, array];
      }

      // 1D array
      if (array[0].length === undefined) {
        for (let i = 0; i < array[0].length; i++) {
          if (array[i] < min) {
            min = array[i];
          } else if (array[i] > max) {
            max = array[i];
          }
        }
        return [min, max];
      }

      // 2D array
      for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < array[0].length; j++) {
          if (array[i][j] < min) {
            min = array[i][j];
          } else if (array[i][j] > max) {
            max = array[i][j];
          }
        }
      }
      return [min, max];
    };

    /**
     * Convert the svg element center coord to document absolute value
     * // Inspired by https://github.com/caged/d3-tip/blob/master/index.js#L286
     * @param {elem} elem 
     */
    const getMidCoords = (svg, elem) => {
      if (svg !== undefined) {
        let targetel = elem;
        while (targetel.getScreenCTM == null && targetel.parentNode != null) {
          targetel = targetel.parentNode;
        }
        // Get the absolute coordinate of the E point of element bbox
        let point = svg.node().ownerSVGElement.createSVGPoint();
        let matrix = targetel.getScreenCTM();
        let tbbox = targetel.getBBox();
        // let width = tbbox.width;
        let height = tbbox.height;

        point.x += 0;
        point.y -= height / 2;
        let bbox = point.matrixTransform(matrix);
        return {
          top: bbox.y,
          left: bbox.x
        };
      }
    };

    /**
     * Return the output knot (right boundary center)
     * @param {object} point {x: x, y:y}
     */
    const getOutputKnot = (point) => {
      return {
        x: point.x + nodeLength$1,
        y: point.y + nodeLength$1 / 2
      };
    };

    /**
     * Return the output knot (left boundary center)
     * @param {object} point {x: x, y:y}
     */
    const getInputKnot = (point) => {
      return {
        x: point.x,
        y: point.y + nodeLength$1 / 2
      }
    };

    /**
     * Compute edge data
     * @param {[[[number, number]]]} nodeCoordinate Constructed neuron svg locations
     * @param {[object]} cnn Constructed CNN model
     */
    const getLinkData = (nodeCoordinate, cnn) => {
      let linkData = [];
      // Create links backward (starting for the first conv layer)
      for (let l = 1; l < cnn.length; l++) {
        for (let n = 0; n < cnn[l].length; n++) {
          let isOutput = cnn[l][n].layerName === 'output';
          let curTarget = getInputKnot(nodeCoordinate[l][n]);
          for (let p = 0; p < cnn[l][n].inputLinks.length; p++) {
            // Specially handle output layer (since we are ignoring the flatten)
            let inputNodeIndex = cnn[l][n].inputLinks[p].source.index;
            
            if (isOutput) {
              let flattenDimension = cnn[l-1][0].output.length *
                cnn[l-1][0].output.length;
              if (inputNodeIndex % flattenDimension !== 0){
                  continue;
              }
              inputNodeIndex = Math.floor(inputNodeIndex / flattenDimension);
            }
            let curSource = getOutputKnot(nodeCoordinate[l-1][inputNodeIndex]);
            let curWeight = cnn[l][n].inputLinks[p].weight;
            linkData.push({
              source: curSource,
              target: curTarget,
              weight: curWeight,
              targetLayerIndex: l,
              targetNodeIndex: n,
              sourceNodeIndex: inputNodeIndex
            });
          }
        }
      }
      return linkData;
    };


    /**
     * Color scale wrapper (support artificially lighter color!)
     * @param {function} colorScale D3 color scale function
     * @param {number} range Color range (max - min)
     * @param {number} value Color value
     * @param {number} gap Tail of the color scale to skip
     */
    const gappedColorScale = (colorScale, range, value, gap) => {
      if (gap === undefined) { gap = 0; }
      let normalizedValue = (value + range / 2) / range;
      return colorScale(normalizedValue * (1 - 2 * gap) + gap);
    };

    /* global d3, SmoothScroll */

    // Configs
    const layerColorScales$2 = overviewConfig.layerColorScales;
    const nodeLength$2 = overviewConfig.nodeLength;
    const numLayers = overviewConfig.numLayers;
    const edgeOpacity = overviewConfig.edgeOpacity;
    const edgeInitColor = overviewConfig.edgeInitColor;
    const edgeStrokeWidth = overviewConfig.edgeStrokeWidth;
    const svgPaddings = overviewConfig.svgPaddings;
    const gapRatio = overviewConfig.gapRatio;
    const classLists = overviewConfig.classLists;
    const formater = d3.format('.4f');

    // Shared variables
    let svg$1 = undefined;
    svgStore.subscribe( value => {svg$1 = value;} );

    let vSpaceAroundGap = undefined;
    vSpaceAroundGapStore.subscribe( value => {vSpaceAroundGap = value;} );

    let hSpaceAroundGap = undefined;
    hSpaceAroundGapStore.subscribe( value => {hSpaceAroundGap = value;} );

    let cnn = undefined;
    cnnStore.subscribe( value => {cnn = value;} );

    let nodeCoordinate = undefined;
    nodeCoordinateStore.subscribe( value => {nodeCoordinate = value;} );

    let selectedScaleLevel = undefined;
    selectedScaleLevelStore.subscribe( value => {selectedScaleLevel = value;} );

    let cnnLayerRanges = undefined;
    cnnLayerRangesStore.subscribe( value => {cnnLayerRanges = value;} );

    let cnnLayerMinMax = undefined;
    cnnLayerMinMaxStore.subscribe( value => {cnnLayerMinMax = value;} );

    let detailedMode = undefined;
    detailedModeStore.subscribe( value => {detailedMode = value;} );

    /**
     * Use bounded d3 data to draw one canvas
     * @param {object} d d3 data
     * @param {index} i d3 data index
     * @param {[object]} g d3 group
     * @param {number} range color range map (max - min)
     */
    const drawOutput = (d, i, g, range) => {
      let image = g[i];
      let colorScale = layerColorScales$2[d.type];

      if (d.type === 'input') {
        colorScale = colorScale[d.index];
      }

      // Set up a second convas in order to resize image
      let imageLength = d.output.length === undefined ? 1 : d.output.length;
      let bufferCanvas = document.createElement("canvas");
      let bufferContext = bufferCanvas.getContext("2d");
      bufferCanvas.width = imageLength;
      bufferCanvas.height = imageLength;

      // Fill image pixel array
      let imageSingle = bufferContext.getImageData(0, 0, imageLength, imageLength);
      let imageSingleArray = imageSingle.data;

      if (imageLength === 1) {
        imageSingleArray[0] = d.output;
      } else {
        for (let i = 0; i < imageSingleArray.length; i+=4) {
          let pixeIndex = Math.floor(i / 4);
          let row = Math.floor(pixeIndex / imageLength);
          let column = pixeIndex % imageLength;
          let color = undefined;
          if (d.type === 'input' || d.type === 'fc' ) {
            color = d3.rgb(colorScale(1 - d.output[row][column]));
          } else {
            color = d3.rgb(colorScale((d.output[row][column] + range / 2) / range));
          }

          imageSingleArray[i] = color.r;
          imageSingleArray[i + 1] = color.g;
          imageSingleArray[i + 2] = color.b;
          imageSingleArray[i + 3] = 255;
        }
      }

      // canvas.toDataURL() only exports image in 96 DPI, so we can hack it to have
      // higher DPI by rescaling the image using canvas magic
      let largeCanvas = document.createElement('canvas');
      largeCanvas.width = nodeLength$2 * 3;
      largeCanvas.height = nodeLength$2 * 3;
      let largeCanvasContext = largeCanvas.getContext('2d');

      // Use drawImage to resize the original pixel array, and put the new image
      // (canvas) into corresponding canvas
      bufferContext.putImageData(imageSingle, 0, 0);
      largeCanvasContext.drawImage(bufferCanvas, 0, 0, imageLength, imageLength,
          0, 0, nodeLength$2 * 3, nodeLength$2 * 3);

      let imageDataURL = largeCanvas.toDataURL();
      d3.select(image).attr('xlink:href', imageDataURL);

      // Destory the buffer canvas
      bufferCanvas.remove();
      largeCanvas.remove();
    };

    /**
     * Draw bar chart to encode the output value
     * @param {object} d d3 data
     * @param {index} i d3 data index
     * @param {[object]} g d3 group
     * @param {function} scale map value to length
     */
    const drawOutputScore = (d, i, g, scale) => {
      let group = d3.select(g[i]);
      group.select('rect.output-rect')
          .transition('output')
          .delay(500)
          .duration(800)
          .ease(d3.easeCubicIn)
          .attr('width', scale(d.output));
    };

    const drawCustomImage = (image, inputLayer) => {

      let imageWidth = image.width;
      // Set up a second convas in order to resize image
      let imageLength = inputLayer[0].output.length;
      let bufferCanvas = document.createElement("canvas");
      let bufferContext = bufferCanvas.getContext("2d");
      bufferCanvas.width = imageLength;
      bufferCanvas.height = imageLength;

      // Fill image pixel array
      let imageSingle = bufferContext.getImageData(0, 0, imageLength, imageLength);
      let imageSingleArray = imageSingle.data;

      for (let i = 0; i < imageSingleArray.length; i+=4) {
        let pixeIndex = Math.floor(i / 4);
        let row = Math.floor(pixeIndex / imageLength);
        let column = pixeIndex % imageLength;


          let red = inputLayer[0].output[row][column];
          imageSingleArray[i] = red * 255;
          imageSingleArray[i] = red * 255;

        if(overviewConfig.modeImg == 3){
          let green = inputLayer[1].output[row][column];
          let blue = inputLayer[2].output[row][column];
          imageSingleArray[i + 1] = green * 255;
          imageSingleArray[i + 2] = blue * 255;
          imageSingleArray[i + 3] = 255;
        }



      }

      // canvas.toDataURL() only exports image in 96 DPI, so we can hack it to have
      // higher DPI by rescaling the image using canvas magic
      let largeCanvas = document.createElement('canvas');
      largeCanvas.width = imageWidth * 3;
      largeCanvas.height = imageWidth * 3;
      let largeCanvasContext = largeCanvas.getContext('2d');

      // Use drawImage to resize the original pixel array, and put the new image
      // (canvas) into corresponding canvas
      bufferContext.putImageData(imageSingle, 0, 0);
      largeCanvasContext.drawImage(bufferCanvas, 0, 0, imageLength, imageLength,
          0, 0, imageWidth * 3, imageWidth * 3);

      let imageDataURL = largeCanvas.toDataURL();
      // d3.select(image).attr('xlink:href', imageDataURL);
      image.src = imageDataURL;

      // Destory the buffer canvas
      bufferCanvas.remove();
      largeCanvas.remove();
    };

    /**
     * Create color gradient for the legend
     * @param {[object]} g d3 group
     * @param {function} colorScale Colormap
     * @param {string} gradientName Label for gradient def
     * @param {number} min Min of legend value
     * @param {number} max Max of legend value
     */
    const getLegendGradient = (g, colorScale, gradientName, min, max) => {
      if (min === undefined) { min = 0; }
      if (max === undefined) { max = 1; }
      let gradient = g.append('defs')
          .append('svg:linearGradient')
          .attr('id', `${gradientName}`)
          .attr('x1', '0%')
          .attr('y1', '100%')
          .attr('x2', '100%')
          .attr('y2', '100%')
          .attr('spreadMethod', 'pad');
      let interpolation = 10;
      for (let i = 0; i < interpolation; i++) {
        let curProgress = i / (interpolation - 1);
        let curColor = colorScale(curProgress * (max - min) + min);
        gradient.append('stop')
            .attr('offset', `${curProgress * 100}%`)
            .attr('stop-color', curColor)
            .attr('stop-opacity', 1);
      }
    };

    /**
     * Draw all legends
     * @param {object} legends Parent group
     * @param {number} legendHeight Height of the legend element
     */
    const drawLegends = (legends, legendHeight) => {
      // Add local legends
      for (let i = 0; i < 2; i++){
        let start = 1 + i * 5;
        let range1 = cnnLayerRanges.local[start];
        let range2 = cnnLayerRanges.local[start + 2];

        let localLegendScale1 = d3.scaleLinear()
            .range([0, 2 * nodeLength$2 + hSpaceAroundGap - 1.2])
            .domain([-range1 / 2, range1 / 2]);

        let localLegendScale2 = d3.scaleLinear()
            .range([0, 3 * nodeLength$2 + 2 * hSpaceAroundGap - 1.2])
            .domain([-range2 / 2, range2 / 2]);

        let localLegendAxis1 = d3.axisBottom()
            .scale(localLegendScale1)
            .tickFormat(d3.format('.2f'))
            .tickValues([-range1 / 2, 0, range1 / 2]);

        let localLegendAxis2 = d3.axisBottom()
            .scale(localLegendScale2)
            .tickFormat(d3.format('.2f'))
            .tickValues([-range2 / 2, 0, range2 / 2]);

        let localLegend1 = legends.append('g')
            .attr('class', 'legend local-legend')
            .attr('id', `local-legend-${i}-1`)
            .classed('hidden', !detailedMode || selectedScaleLevel !== 'local')
            .attr('transform', `translate(${nodeCoordinate[start][0].x}, ${0})`);

        localLegend1.append('g')
            .attr('transform', `translate(0, ${legendHeight - 3})`)
            .call(localLegendAxis1);

        localLegend1.append('rect')
            .attr('width', 2 * nodeLength$2 + hSpaceAroundGap)
            .attr('height', legendHeight)
            .style('fill', 'url(#convGradient)');

        let localLegend2 = legends.append('g')
            .attr('class', 'legend local-legend')
            .attr('id', `local-legend-${i}-2`)
            .classed('hidden', !detailedMode || selectedScaleLevel !== 'local')
            .attr('transform', `translate(${nodeCoordinate[start + 2][0].x}, ${0})`);

        localLegend2.append('g')
            .attr('transform', `translate(0, ${legendHeight - 3})`)
            .call(localLegendAxis2);

        localLegend2.append('rect')
            .attr('width', 3 * nodeLength$2 + 2 * hSpaceAroundGap)
            .attr('height', legendHeight)
            .style('fill', 'url(#convGradient)');
      }

      // Add module legends
      for (let i = 0; i < 2; i++){
        let start = 1 + i * 5;
        let range = cnnLayerRanges.module[start];

        let moduleLegendScale = d3.scaleLinear()
            .range([0, 5 * nodeLength$2 + 3 * hSpaceAroundGap +
            1 * hSpaceAroundGap * gapRatio - 1.2])
            .domain([-range / 2, range / 2]);

        let moduleLegendAxis = d3.axisBottom()
            .scale(moduleLegendScale)
            .tickFormat(d3.format('.2f'))
            .tickValues([-range / 2, -(range / 4), 0, range / 4, range / 2]);

        let moduleLegend = legends.append('g')
            .attr('class', 'legend module-legend')
            .attr('id', `module-legend-${i}`)
            .classed('hidden', !detailedMode || selectedScaleLevel !== 'module')
            .attr('transform', `translate(${nodeCoordinate[start][0].x}, ${0})`);

        moduleLegend.append('g')
            .attr('transform', `translate(0, ${legendHeight - 3})`)
            .call(moduleLegendAxis);

        moduleLegend.append('rect')
            .attr('width', 5 * nodeLength$2 + 3 * hSpaceAroundGap +
                1 * hSpaceAroundGap * gapRatio)
            .attr('height', legendHeight)
            .style('fill', 'url(#convGradient)');
      }

      // Add global legends
      let start = 1;
      let range = cnnLayerRanges.global[start];

      let globalLegendScale = d3.scaleLinear()
          .range([0, 10 * nodeLength$2 + 6 * hSpaceAroundGap +
          3 * hSpaceAroundGap * gapRatio - 1.2])
          .domain([-range / 2, range / 2]);

      let globalLegendAxis = d3.axisBottom()
          .scale(globalLegendScale)
          .tickFormat(d3.format('.2f'))
          .tickValues([-range / 2, -(range / 4), 0, range / 4, range / 2]);

      let globalLegend = legends.append('g')
          .attr('class', 'legend global-legend')
          .attr('id', 'global-legend')
          .classed('hidden', !detailedMode || selectedScaleLevel !== 'global')
          .attr('transform', `translate(${nodeCoordinate[start][0].x}, ${0})`);

      globalLegend.append('g')
          .attr('transform', `translate(0, ${legendHeight - 3})`)
          .call(globalLegendAxis);

      globalLegend.append('rect')
          .attr('width', 10 * nodeLength$2 + 6 * hSpaceAroundGap +
              3 * hSpaceAroundGap * gapRatio)
          .attr('height', legendHeight)
          .style('fill', 'url(#convGradient)');


      // Add output legend
      let outputRectScale = d3.scaleLinear()
          .domain(cnnLayerRanges.output)
          .range([0, nodeLength$2 - 1.2]);

      let outputLegendAxis = d3.axisBottom()
          .scale(outputRectScale)
          .tickFormat(d3.format('.1f'))
          .tickValues([0, cnnLayerRanges.output[1]]);

      console.log(nodeCoordinate);

      let outputLegend = legends.append('g')
          .attr('class', 'legend output-legend')
          .attr('id', 'output-legend')
          .classed('hidden', !detailedMode)
          .attr('transform', `translate(${nodeCoordinate[11][0].x}, ${0})`);

      outputLegend.append('g')
          .attr('transform', `translate(0, ${legendHeight - 3})`)
          .call(outputLegendAxis);

      outputLegend.append('rect')
          .attr('width', nodeLength$2)
          .attr('height', legendHeight)
          .style('fill', 'gray');

      // Add input image legend
      let inputScale = d3.scaleLinear()
          .range([0, nodeLength$2 - 1.2])
          .domain([0, 1]);

      let inputLegendAxis = d3.axisBottom()
          .scale(inputScale)
          .tickFormat(d3.format('.1f'))
          .tickValues([0, 0.5, 1]);

      let inputLegend = legends.append('g')
          .attr('class', 'legend input-legend')
          .classed('hidden', !detailedMode)
          .attr('transform', `translate(${nodeCoordinate[0][0].x}, ${0})`);

      inputLegend.append('g')
          .attr('transform', `translate(0, ${legendHeight - 3})`)
          .call(inputLegendAxis);

      inputLegend.append('rect')
          .attr('x', 0.3)
          .attr('width', nodeLength$2 - 0.3)
          .attr('height', legendHeight)
          .attr('transform', `rotate(180, ${nodeLength$2/2}, ${legendHeight/2})`)
          .style('stroke', 'rgb(20, 20, 20)')
          .style('stroke-width', 0.3)
          .style('fill', 'url(#inputGradient)');
    };

    /**
     * Draw the overview
     * @param {number} width Width of the cnn group
     * @param {number} height Height of the cnn group
     * @param {object} cnnGroup Group to appen cnn elements to
     * @param {function} nodeMouseOverHandler Callback func for mouseOver
     * @param {function} nodeMouseLeaveHandler Callback func for mouseLeave
     * @param {function} nodeClickHandler Callback func for click
     */
    const drawCNN = (width, height, cnnGroup, nodeMouseOverHandler,
                            nodeMouseLeaveHandler, nodeClickHandler) => {
      // Draw the CNN
      // There are 8 short gaps and 5 long gaps
      hSpaceAroundGap = (width - nodeLength$2 * numLayers) / (8 + 5 * gapRatio);
      hSpaceAroundGapStore.set(hSpaceAroundGap);
      let leftAccuumulatedSpace = 0;

      // Iterate through the cnn to draw nodes in each layer
      console.log("cnn.length = " + cnn.length);
      for (let l = 0; l < cnn.length; l++) {
        let curLayer = cnn[l];
        let isOutput = curLayer[0].layerName === 'output';

        nodeCoordinate.push([]);

        // Compute the x coordinate of the whole layer
        // Output layer and conv layer has long gaps
        if (isOutput || curLayer[0].type === 'conv') {
          leftAccuumulatedSpace += hSpaceAroundGap * gapRatio;
        } else {
          leftAccuumulatedSpace += hSpaceAroundGap;
        }

        // All nodes share the same x coordiante (left in div style)
        let left = leftAccuumulatedSpace;

        let layerGroup = cnnGroup.append('g')
            .attr('class', 'cnn-layer-group')
            .attr('id', `cnn-layer-group-${l}`);

        vSpaceAroundGap = (height - nodeLength$2 * curLayer.length) /
            (curLayer.length + 1);
        vSpaceAroundGapStore.set(vSpaceAroundGap);

        let nodeGroups = layerGroup.selectAll('g.node-group')
            .data(curLayer, d => d.index)
            .enter()
            .append('g')
            .attr('class', 'node-group')
            .style('cursor', 'pointer')
            .style('pointer-events', 'all')
            .on('click', nodeClickHandler)
            .on('mouseover', nodeMouseOverHandler)
            .on('mouseleave', nodeMouseLeaveHandler)
            .classed('node-output', isOutput)
            .attr('id', (d, i) => {
              // Compute the coordinate
              // Not using transform on the group object because of a decade old
              // bug on webkit (safari)
              // https://bugs.webkit.org/show_bug.cgi?id=23113
              let top = i * nodeLength$2 + (i + 1) * vSpaceAroundGap;
              top += svgPaddings.top;
              nodeCoordinate[l].push({x: left, y: top});
              return `layer-${l}-node-${i}`
            });

        // Overwrite the mouseover and mouseleave function for output nodes to show
        // hover info in the UI
        layerGroup.selectAll('g.node-output')
            .on('mouseover', (d, i, g) => {
              nodeMouseOverHandler(d, i, g);
              hoverInfoStore.set( {show: true, text: `Output value: ${formater(d.output)}`} );
            })
            .on('mouseleave', (d, i, g) => {
              nodeMouseLeaveHandler(d, i, g);
              hoverInfoStore.set( {show: false, text: `Output value: ${formater(d.output)}`} );
            });

        if (curLayer[0].layerName !== 'output') {
          // Embed raster image in these groups
          nodeGroups.append('image')
              .attr('class', 'node-image')
              .attr('width', nodeLength$2)
              .attr('height', nodeLength$2)
              .attr('x', left)
              .attr('y', (d, i) => nodeCoordinate[l][i].y);

          // Add a rectangle to show the border
          nodeGroups.append('rect')
              .attr('class', 'bounding')
              .attr('width', nodeLength$2)
              .attr('height', nodeLength$2)
              .attr('x', left)
              .attr('y', (d, i) => nodeCoordinate[l][i].y)
              .style('fill', 'none')
              .style('stroke', 'gray')
              .style('stroke-width', 1)
              .classed('hidden', true);
        } else {
          nodeGroups.append('rect')
              .attr('class', 'output-rect')
              .attr('x', left)
              .attr('y', (d, i) => nodeCoordinate[l][i].y + nodeLength$2 / 2 + 8)
              .attr('height', nodeLength$2 / 4)
              .attr('width', 0)
              .style('fill', 'gray');
          nodeGroups.append('text')
              .attr('class', 'output-text')
              .attr('x', left)
              .attr('y', (d, i) => nodeCoordinate[l][i].y + nodeLength$2 / 2)
              .style('dominant-baseline', 'middle')
              .style('font-size', '11px')
              .style('fill', 'black')
              .style('opacity', 0.5)
              .text((d, i) => classLists[i]);

          // Add annotation text to tell readers the exact output probability
          // nodeGroups.append('text')
          //   .attr('class', 'annotation-text')
          //   .attr('id', (d, i) => `output-prob-${i}`)
          //   .attr('x', left)
          //   .attr('y', (d, i) => nodeCoordinate[l][i].y + 10)
          //   .text(d => `(${d3.format('.4f')(d.output)})`);
        }
        leftAccuumulatedSpace += nodeLength$2;
      }

      // Share the nodeCoordinate
      nodeCoordinateStore.set(nodeCoordinate);

      // Compute the scale of the output score width (mapping the the node
      // width to the max output score)
      let outputRectScale = d3.scaleLinear()
          .domain(cnnLayerRanges.output)
          .range([0, nodeLength$2]);

      // Draw the canvas
      for (let l = 0; l < cnn.length; l++) {
        let range = cnnLayerRanges[selectedScaleLevel][l];
        svg$1.select(`g#cnn-layer-group-${l}`)
            .selectAll('image.node-image')
            .each((d, i, g) => drawOutput(d, i, g, range));
      }

      svg$1.selectAll('g.node-output').each(
          (d, i, g) => drawOutputScore(d, i, g, outputRectScale)
      );

      // Add layer label
      let layerNames = cnn.map(d => {
        if (d[0].layerName === 'output') {
          return {
            name: d[0].layerName,
            dimension: `(${d.length})`
          }
        } else {
          return {
            name: d[0].layerName,
            dimension: `(${d[0].output.length}, ${d[0].output.length}, ${d.length})`
          }
        }
      });

      let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
      let scroll = new SmoothScroll('a[href*="#"]', {offset: -svgHeight});

      let detailedLabels = svg$1.selectAll('g.layer-detailed-label')
          .data(layerNames)
          .enter()
          .append('g')
          .attr('class', 'layer-detailed-label')
          .attr('id', (d, i) => `layer-detailed-label-${i}`)
          .classed('hidden', !detailedMode)
          .attr('transform', (d, i) => {
            let x = nodeCoordinate[i][0].x + nodeLength$2 / 2;
            let y = (svgPaddings.top + vSpaceAroundGap) / 2 - 6;
            return `translate(${x}, ${y})`;
          })
          .style('cursor', d => d.name.includes('output') ? 'default' : 'help')
          .on('click', (d) => {
            let target = '';
            if (d.name.includes('conv')) { target = 'convolution'; }
            if (d.name.includes('relu')) { target = 'relu'; }
            if (d.name.includes('max_pool')) { target = 'pooling';}
            if (d.name.includes('input')) { target = 'input';}

            // Scroll to a article element
            let anchor = document.querySelector(`#article-${target}`);
            scroll.animateScroll(anchor);
          });

      detailedLabels.append('title')
          .text('Move to article section');

      detailedLabels.append('text')
          .style('opacity', 0.7)
          .style('dominant-baseline', 'middle')
          .append('tspan')
          .style('font-size', '12px')
          .text(d => d.name)
          .append('tspan')
          .style('font-size', '8px')
          .style('font-weight', 'normal')
          .attr('x', 0)
          .attr('dy', '1.5em')
          .text(d => d.dimension);

      let labels = svg$1.selectAll('g.layer-label')
          .data(layerNames)
          .enter()
          .append('g')
          .attr('class', 'layer-label')
          .attr('id', (d, i) => `layer-label-${i}`)
          .classed('hidden', detailedMode)
          .attr('transform', (d, i) => {
            let x = nodeCoordinate[i][0].x + nodeLength$2 / 2;
            let y = (svgPaddings.top + vSpaceAroundGap) / 2 + 5;
            return `translate(${x}, ${y})`;
          })
          .style('cursor', d => d.name.includes('output') ? 'default' : 'help')
          .on('click', (d) => {
            let target = '';
            if (d.name.includes('conv')) { target = 'convolution'; }
            if (d.name.includes('relu')) { target = 'relu'; }
            if (d.name.includes('max_pool')) { target = 'pooling';}
            if (d.name.includes('input')) { target = 'input';}

            // Scroll to a article element
            let anchor = document.querySelector(`#article-${target}`);
            scroll.animateScroll(anchor);
          });

      labels.append('title')
          .text('Move to article section');

      labels.append('text')
          .style('dominant-baseline', 'middle')
          .style('opacity', 0.8)
          .text(d => {
            if (d.name.includes('conv')) { return 'conv' }
            if (d.name.includes('relu')) { return 'relu' }
            if (d.name.includes('max_pool')) { return 'max_pool'}
            return d.name
          });

      // Add layer color scale legends
      getLegendGradient(svg$1, layerColorScales$2.conv, 'convGradient');
      getLegendGradient(svg$1, layerColorScales$2.input[0], 'inputGradient');

      let legendHeight = 5;
      let legends = svg$1.append('g')
          .attr('class', 'color-legend')
          .attr('transform', `translate(${0}, ${
          svgPaddings.top + vSpaceAroundGap * (classLists.length) + vSpaceAroundGap +
          nodeLength$2 * classLists.length
      })`);

      drawLegends(legends, legendHeight);

      // Add edges between nodes
      let linkGen = d3.linkHorizontal()
          .x(d => d.x)
          .y(d => d.y);

      let linkData = getLinkData(nodeCoordinate, cnn);

      let edgeGroup = cnnGroup.append('g')
          .attr('class', 'edge-group');

      edgeGroup.selectAll('path.edge')
          .data(linkData)
          .enter()
          .append('path')
          .attr('class', d =>
              `edge edge-${d.targetLayerIndex} edge-${d.targetLayerIndex}-${d.targetNodeIndex}`)
          .attr('id', d =>
              `edge-${d.targetLayerIndex}-${d.targetNodeIndex}-${d.sourceNodeIndex}`)
          .attr('d', d => linkGen({source: d.source, target: d.target}))
          .style('fill', 'none')
          .style('stroke-width', edgeStrokeWidth)
          .style('opacity', edgeOpacity)
          .style('stroke', edgeInitColor);

      // Add input channel annotations
      let inputAnnotation = cnnGroup.append('g')
          .attr('class', 'input-annotation');

      let redChannel = inputAnnotation.append('text')
          .attr('x', nodeCoordinate[0][0].x + nodeLength$2 / 2)
          .attr('y', nodeCoordinate[0][0].y + nodeLength$2 + 5)
          .attr('class', 'annotation-text')
          .style('dominant-baseline', 'hanging')
          .style('text-anchor', 'middle');

      let color1 = "Red";

      if(overviewConfig.modeImg < 3){

        color1 = "Gray";

      }
      redChannel.append('tspan')
          .style('dominant-baseline', 'hanging')
          .style('fill', '#C95E67')
          .text(color1);

      redChannel.append('tspan')
          .style('dominant-baseline', 'hanging')
          .text(' channel');

      if(overviewConfig.modeImg == 3){
        inputAnnotation.append('text')
            .attr('x', nodeCoordinate[0][1].x + nodeLength$2 / 2)
            .attr('y', nodeCoordinate[0][1].y + nodeLength$2 + 5)
            .attr('class', 'annotation-text')
            .style('dominant-baseline', 'hanging')
            .style('text-anchor', 'middle')
            .style('fill', '#3DB665')
            .text('Green');

        inputAnnotation.append('text')
            .attr('x', nodeCoordinate[0][2].x + nodeLength$2 / 2)
            .attr('y', nodeCoordinate[0][2].y + nodeLength$2 + 5)
            .attr('class', 'annotation-text')
            .style('dominant-baseline', 'hanging')
            .style('text-anchor', 'middle')
            .style('fill', '#3F7FBC')
            .text('Blue');
      }
    };

    /**
     * Update canvas values when user changes input image
     */
    const updateCNN = () => {
      // Compute the scale of the output score width (mapping the the node
      // width to the max output score)
      let outputRectScale = d3.scaleLinear()
          .domain(cnnLayerRanges.output)
          .range([0, nodeLength$2]);

      // Rebind the cnn data to layer groups layer by layer
      for (let l = 0; l < cnn.length; l++) {
        let curLayer = cnn[l];
        let range = cnnLayerRanges[selectedScaleLevel][l];
        let layerGroup = svg$1.select(`g#cnn-layer-group-${l}`);

        let nodeGroups = layerGroup.selectAll('g.node-group')
            .data(curLayer);

        if (l < cnn.length - 1) {
          // Redraw the canvas and output node
          nodeGroups.transition('disappear')
              .duration(300)
              .ease(d3.easeCubicOut)
              .style('opacity', 0)
              .on('end', function() {
                d3.select(this)
                    .select('image.node-image')
                    .each((d, i, g) => drawOutput(d, i, g, range));
                d3.select(this).transition('appear')
                    .duration(700)
                    .ease(d3.easeCubicIn)
                    .style('opacity', 1);
              });
        } else {
          nodeGroups.each(
              (d, i, g) => drawOutputScore(d, i, g, outputRectScale)
          );
        }
      }

      // Update the color scale legend
      // Local legends
      for (let i = 0; i < 2; i++){
        let start = 1 + i * 5;
        let range1 = cnnLayerRanges.local[start];
        let range2 = cnnLayerRanges.local[start + 2];

        let localLegendScale1 = d3.scaleLinear()
            .range([0, 2 * nodeLength$2 + hSpaceAroundGap])
            .domain([-range1 / 2, range1 / 2]);

        let localLegendScale2 = d3.scaleLinear()
            .range([0, 3 * nodeLength$2 + 2 * hSpaceAroundGap])
            .domain([-range2 / 2, range2 / 2]);

        let localLegendAxis1 = d3.axisBottom()
            .scale(localLegendScale1)
            .tickFormat(d3.format('.2f'))
            .tickValues([-range1 / 2, 0, range1 / 2]);

        let localLegendAxis2 = d3.axisBottom()
            .scale(localLegendScale2)
            .tickFormat(d3.format('.2f'))
            .tickValues([-range2 / 2, 0, range2 / 2]);

        svg$1.select(`g#local-legend-${i}-1`).select('g').call(localLegendAxis1);
        svg$1.select(`g#local-legend-${i}-2`).select('g').call(localLegendAxis2);
      }

      // Module legend
      for (let i = 0; i < 2; i++){
        let start = 1 + i * 5;
        let range = cnnLayerRanges.local[start];

        let moduleLegendScale = d3.scaleLinear()
            .range([0, 5 * nodeLength$2 + 3 * hSpaceAroundGap +
            1 * hSpaceAroundGap * gapRatio - 1.2])
            .domain([-range, range]);

        let moduleLegendAxis = d3.axisBottom()
            .scale(moduleLegendScale)
            .tickFormat(d3.format('.2f'))
            .tickValues([-range, -(range / 2), 0, range/2, range]);

        svg$1.select(`g#module-legend-${i}`).select('g').call(moduleLegendAxis);
      }

      // Global legend
      let start = 1;
      let range = cnnLayerRanges.global[start];

      let globalLegendScale = d3.scaleLinear()
          .range([0, 10 * nodeLength$2 + 6 * hSpaceAroundGap +
          3 * hSpaceAroundGap * gapRatio - 1.2])
          .domain([-range, range]);

      let globalLegendAxis = d3.axisBottom()
          .scale(globalLegendScale)
          .tickFormat(d3.format('.2f'))
          .tickValues([-range, -(range / 2), 0, range/2, range]);

      svg$1.select(`g#global-legend`).select('g').call(globalLegendAxis);

      // Output legend
      let outputLegendAxis = d3.axisBottom()
          .scale(outputRectScale)
          .tickFormat(d3.format('.1f'))
          .tickValues([0, cnnLayerRanges.output[1]]);

      svg$1.select('g#output-legend').select('g').call(outputLegendAxis);
    };

    /**
     * Update the ranges for current CNN layers
     */
    const updateCNNLayerRanges = () => {
      // Iterate through all nodes to find a output ranges for each layer
      let cnnLayerRangesLocal = [1];
      let curRange = undefined;

      // Also track the min/max of each layer (avoid computing during intermediate
      // layer)
      cnnLayerMinMax = [];

      for (let l = 0; l < cnn.length - 1; l++) {
        let curLayer = cnn[l];

        // Compute the min max
        let outputExtents = curLayer.map(l => getExtent(l.output));
        let aggregatedExtent = outputExtents.reduce((acc, cur) => {
          return [Math.min(acc[0], cur[0]), Math.max(acc[1], cur[1])];
        });
        cnnLayerMinMax.push({min: aggregatedExtent[0], max: aggregatedExtent[1]});

        // conv layer refreshes curRange counting
        if (curLayer[0].type === 'conv' || curLayer[0].type === 'fc') {
          aggregatedExtent = aggregatedExtent.map(Math.abs);
          // Plus 0.1 to offset the rounding error (avoid black color)
          curRange = 2 * (0.1 +
              Math.round(Math.max(...aggregatedExtent) * 1000) / 1000);
        }

        if (curRange !== undefined){
          cnnLayerRangesLocal.push(curRange);
        }
      }

      // Finally, add the output layer range
      cnnLayerRangesLocal.push(1);
      cnnLayerMinMax.push({min: 0, max: 1});

      // Support different levels of scales (1) lcoal, (2) component, (3) global
      let cnnLayerRangesComponent = [1];
      let numOfComponent = (numLayers - 2) / 5;
      for (let i = 0; i < numOfComponent; i++) {
        let curArray = cnnLayerRangesLocal.slice(1 + 5 * i, 1 + 5 * i + 5);
        let maxRange = Math.max(...curArray);
        for (let j = 0; j < 5; j++) {
          cnnLayerRangesComponent.push(maxRange);
        }
      }
      cnnLayerRangesComponent.push(1);

      let cnnLayerRangesGlobal = [1];
      let maxRange = Math.max(...cnnLayerRangesLocal.slice(1,
          cnnLayerRangesLocal.length - 1));
      for (let i = 0; i < numLayers - 2; i++) {
        cnnLayerRangesGlobal.push(maxRange);
      }
      cnnLayerRangesGlobal.push(1);

      // Update the ranges dictionary
      cnnLayerRanges.local = cnnLayerRangesLocal;
      cnnLayerRanges.module = cnnLayerRangesComponent;
      cnnLayerRanges.global = cnnLayerRangesGlobal;
      cnnLayerRanges.output = [0, d3.max(cnn[cnn.length - 1].map(d => d.output))];

      cnnLayerRangesStore.set(cnnLayerRanges);
      cnnLayerMinMaxStore.set(cnnLayerMinMax);
    };

    /* global d3 */

    // Configs
    const layerColorScales$3 = overviewConfig.layerColorScales;
    const nodeLength$3 = overviewConfig.nodeLength;
    const intermediateColor = overviewConfig.intermediateColor;
    const svgPaddings$1 = overviewConfig.svgPaddings;

    // Shared variables
    let svg$2 = undefined;
    svgStore.subscribe( value => {svg$2 = value;} );

    let vSpaceAroundGap$1 = undefined;
    vSpaceAroundGapStore.subscribe( value => {vSpaceAroundGap$1 = value;} );

    /**
     * Move one layer horizontally
     * @param {object} arg Multiple arguments {
     *   layerIndex: current layer index
     *   targetX: destination x
     *   disable: make this layer unresponsible
     *   delay: animation delay
     *   opacity: change the current layer's opacity
     *   specialIndex: avoid manipulating `specialIndex`th node
     *   onEndFunc: call this function when animation finishes
     *   transitionName: animation ID
     * }
     */
    const moveLayerX = (arg) => {
      let layerIndex = arg.layerIndex;
      let targetX = arg.targetX;
      let disable = arg.disable;
      let delay = arg.delay;
      let opacity = arg.opacity;
      let specialIndex = arg.specialIndex;
      let onEndFunc = arg.onEndFunc;
      let transitionName = arg.transitionName === undefined ? 'move' : arg.transitionName;
      let duration = arg.duration === undefined ? 500 : arg.duration;

      // Move the selected layer
      let curLayer = svg$2.select(`g#cnn-layer-group-${layerIndex}`);
      curLayer.selectAll('g.node-group').each((d, i, g) => {
        d3.select(g[i])
          .style('cursor', disable && i !== specialIndex ? 'default' : 'pointer')
          .style('pointer-events', disable && i !== specialIndex ? 'none' : 'all')
          .select('image')
          .transition(transitionName)
          .ease(d3.easeCubicInOut)
          .delay(delay)
          .duration(duration)
          .attr('x', targetX);
        
        d3.select(g[i])
          .select('rect.bounding')
          .transition(transitionName)
          .ease(d3.easeCubicInOut)
          .delay(delay)
          .duration(duration)
          .attr('x', targetX);
        
        if (opacity !== undefined && i !== specialIndex) {
          d3.select(g[i])
            .select('image')
            .style('opacity', opacity);
        }
      });
      
      // Also move the layer labels
      svg$2.selectAll(`g#layer-label-${layerIndex}`)
        .transition(transitionName)
        .ease(d3.easeCubicInOut)
        .delay(delay)
        .duration(duration)
        .attr('transform', () => {
          let x = targetX + nodeLength$3 / 2;
          let y = (svgPaddings$1.top + vSpaceAroundGap$1) / 2 + 5;
          return `translate(${x}, ${y})`;
        })
        .on('end', onEndFunc);

      svg$2.selectAll(`g#layer-detailed-label-${layerIndex}`)
        .transition(transitionName)
        .ease(d3.easeCubicInOut)
        .delay(delay)
        .duration(duration)
        .attr('transform', () => {
          let x = targetX + nodeLength$3 / 2;
          let y = (svgPaddings$1.top + vSpaceAroundGap$1) / 2 - 6;
          return `translate(${x}, ${y})`;
        })
        .on('end', onEndFunc);
    };

    /**
     * Append a gradient definition to `group`
     * @param {string} gradientID CSS ID for the gradient def
     * @param {[{offset: number, color: string, opacity: number}]} stops Gradient stops
     * @param {element} group Element to append def to
     */
    const addOverlayGradient = (gradientID, stops, group) => {
      if (group === undefined) {
        group = svg$2;
      }

      // Create a gradient
      let defs = group.append("defs")
        .attr('class', 'overlay-gradient');

      let gradient = defs.append("linearGradient")
        .attr("id", gradientID)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "100%")
        .attr("y2", "100%");
      
      stops.forEach(s => {
        gradient.append('stop')
          .attr('offset', s.offset)
          .attr('stop-color', s.color)
          .attr('stop-opacity', s.opacity);
      });
    };

    /**
     * Draw the legend for intermediate layer
     * @param {object} arg 
     * {
     *   legendHeight: height of the legend rectangle
     *   curLayerIndex: the index of selected layer
     *   range: colormap range
     *   group: group to append the legend
     *   minMax: {min: min value, max: max value}
     *   width: width of the legend
     *   x: x position of the legend
     *   y: y position of the legend
     *   isInput: if the legend is for the input layer (special handle black to
     *      white color scale)
     *   colorScale: d3 color scale
     *   gradientAppendingName: name of the appending gradient
     *   gradientGap: gap to make the color lighter
     * }
     */
    const drawIntermediateLayerLegend = (arg) => {
      let legendHeight = arg.legendHeight,
        curLayerIndex = arg.curLayerIndex,
        range = arg.range,
        group = arg.group,
        minMax = arg.minMax,
        width = arg.width,
        x = arg.x,
        y = arg.y,
        isInput = arg.isInput,
        colorScale = arg.colorScale,
        gradientAppendingName = arg.gradientAppendingName,
        gradientGap = arg.gradientGap;
      
      if (colorScale === undefined) { colorScale = layerColorScales$3.conv; }
      if (gradientGap === undefined) { gradientGap = 0; }
      
      // Add a legend color gradient
      let gradientName = 'url(#inputGradient)';
      let normalizedColor = v => colorScale(v * (1 - 2 * gradientGap) + gradientGap);

      if (!isInput) {
        let leftValue = (minMax.min + range / 2) / range,
          zeroValue = (0 + range / 2) / range,
          rightValue = (minMax.max + range / 2) / range,
          totalRange = minMax.max - minMax.min,
          zeroLocation = (0 - minMax.min) / totalRange,
          leftMidValue = leftValue + (zeroValue - leftValue)/2,
          rightMidValue = zeroValue + (rightValue - zeroValue)/2;

        let stops = [
          {offset: 0, color: normalizedColor(leftValue), opacity: 1},
          {offset: zeroLocation / 2,
            color: normalizedColor(leftMidValue),
            opacity: 1},
          {offset: zeroLocation,
            color: normalizedColor(zeroValue),
            opacity: 1},
          {offset: zeroLocation + (1 - zeroValue) / 2,
            color: normalizedColor(rightMidValue),
            opacity: 1},
          {offset: 1, color: normalizedColor(rightValue), opacity: 1}
        ];

        if (gradientAppendingName === undefined) {
          addOverlayGradient('intermediate-legend-gradient', stops, group);
          gradientName = 'url(#intermediate-legend-gradient)';
        } else {
          addOverlayGradient(`${gradientAppendingName}`, stops, group);
          gradientName = `url(#${gradientAppendingName})`;
        }
      }

      let legendScale = d3.scaleLinear()
        .range([0, width - 1.2])
        .domain(isInput ? [0, range] : [minMax.min, minMax.max]);

      let legendAxis = d3.axisBottom()
        .scale(legendScale)
        .tickFormat(d3.format(isInput ? 'd' : '.2f'))
        .tickValues(isInput ? [0, range] : [minMax.min, 0, minMax.max]);
      
      let intermediateLegend = group.append('g')
        .attr('class', `intermediate-legend-${curLayerIndex - 1}`)
        .attr('transform', `translate(${x}, ${y})`);
      
      let legendGroup = intermediateLegend.append('g')
        .attr('transform', `translate(0, ${legendHeight - 3})`)
        .call(legendAxis);
      
      legendGroup.selectAll('text')
        .style('font-size', '9px')
        .style('fill', intermediateColor);
      
      legendGroup.selectAll('path, line')
        .style('stroke', intermediateColor);

      intermediateLegend.append('rect')
        .attr('width', width)
        .attr('height', legendHeight)
        .attr('transform', `rotate(${isInput ? 180 : 0},
      ${width / 2}, ${legendHeight / 2})`)
        .style('fill', gradientName);
    };

    /**
     * Draw an very neat arrow!
     * @param {object} arg 
     * {
     *   group: element to append this arrow to
     *   sx: source x
     *   sy: source y
     *   tx: target x
     *   ty: target y
     *   dr: radius of curve (I'm using a circle)
     *   hFlip: the direction to choose the circle (there are always two ways)
     * }
     */
    const drawArrow = (arg) => {
      let group = arg.group,
        sx = arg.sx,
        sy = arg.sy,
        tx = arg.tx,
        ty = arg.ty,
        dr = arg.dr,
        hFlip = arg.hFlip,
        marker = arg.marker === undefined ? 'marker' : arg.marker;

      /* Cool graphics trick -> merge translate and scale together
      translateX = (1 - scaleX) * tx,
      translateY = (1 - scaleY) * ty;
      */
      
      let arrow = group.append('g')
        .attr('class', 'arrow-group');

      arrow.append('path')
        .attr("d", `M${sx},${sy}A${dr},${dr} 0 0,${hFlip ? 0 : 1} ${tx},${ty}`)
        .attr('marker-end', `url(#${marker})`)
        .style('stroke', 'gray')
        .style('fill', 'none');
    };

    /* global d3 */

    // Configs
    const layerColorScales$4 = overviewConfig.layerColorScales;
    const nodeLength$4 = overviewConfig.nodeLength;
    const plusSymbolRadius = overviewConfig.plusSymbolRadius;
    const numLayers$1 = overviewConfig.numLayers;
    const intermediateColor$1 = overviewConfig.intermediateColor;
    const kernelRectLength = overviewConfig.kernelRectLength;
    const svgPaddings$2 = overviewConfig.svgPaddings;
    const gapRatio$1 = overviewConfig.gapRatio;
    const overlayRectOffset = overviewConfig.overlayRectOffset;
    const formater$1 = d3.format('.4f');
    let isEndOfAnimation = false;

    // Shared variables
    let svg$3 = undefined;
    svgStore.subscribe( value => {svg$3 = value;} );

    let vSpaceAroundGap$2 = undefined;
    vSpaceAroundGapStore.subscribe( value => {vSpaceAroundGap$2 = value;} );

    let hSpaceAroundGap$1 = undefined;
    hSpaceAroundGapStore.subscribe( value => {hSpaceAroundGap$1 = value;} );

    let cnn$1 = undefined;
    cnnStore.subscribe( value => {cnn$1 = value;} );

    let nodeCoordinate$1 = undefined;
    nodeCoordinateStore.subscribe( value => {nodeCoordinate$1 = value;} );

    let selectedScaleLevel$1 = undefined;
    selectedScaleLevelStore.subscribe( value => {selectedScaleLevel$1 = value;} );

    let cnnLayerRanges$1 = undefined;
    cnnLayerRangesStore.subscribe( value => {cnnLayerRanges$1 = value;} );

    let cnnLayerMinMax$1 = undefined;
    cnnLayerMinMaxStore.subscribe( value => {cnnLayerMinMax$1 = value;} );

    let needRedraw = [undefined, undefined];
    needRedrawStore.subscribe( value => {needRedraw = value;} );

    let shouldIntermediateAnimate = undefined;
    shouldIntermediateAnimateStore.subscribe(value => {
      shouldIntermediateAnimate = value;
    });

    let detailedMode$1 = undefined;
    detailedModeStore.subscribe( value => {detailedMode$1 = value;} );

    let intermediateLayerPosition = undefined;
    intermediateLayerPositionStore.subscribe ( value => {intermediateLayerPosition = value;} );

    // let curRightX = 0;

    /**
     * Draw the intermediate layer activation heatmaps
     * @param {element} image Neuron heatmap image
     * @param {number} range Colormap range
     * @param {function} colorScale Colormap
     * @param {number} length Image length
     * @param {[[number]]} dataMatrix Heatmap matrix
     */
    const drawIntermidiateImage = (image, range, colorScale, length,
      dataMatrix) => {
      // Set up a buffer convas in order to resize image
      let imageLength = length;
      let bufferCanvas = document.createElement("canvas");
      let bufferContext = bufferCanvas.getContext("2d");
      bufferCanvas.width = imageLength;
      bufferCanvas.height = imageLength;

      // Fill image pixel array
      let imageSingle = bufferContext.getImageData(0, 0, imageLength, imageLength);
      let imageSingleArray = imageSingle.data;

      for (let i = 0; i < imageSingleArray.length; i+=4) {
        let pixeIndex = Math.floor(i / 4);
        let row = Math.floor(pixeIndex / imageLength);
        let column = pixeIndex % imageLength;

        imageSingleArray[i] = 255;
        if(overviewConfig.modeImg > 1){
          let color = d3.rgb(colorScale((dataMatrix[row][column] + range / 2) / range));
          imageSingleArray[i] = color.r;
          imageSingleArray[i + 1] = color.g;
          imageSingleArray[i + 2] = color.b;
          imageSingleArray[i + 3] = 255;
        }
      }

      // canvas.toDataURL() only exports image in 96 DPI, so we can hack it to have
      // higher DPI by rescaling the image using canvas magic
      let largeCanvas = document.createElement('canvas');
      largeCanvas.width = nodeLength$4 * 3;
      largeCanvas.height = nodeLength$4 * 3;
      let largeCanvasContext = largeCanvas.getContext('2d');

      // Use drawImage to resize the original pixel array, and put the new image
      // (canvas) into corresponding canvas
      bufferContext.putImageData(imageSingle, 0, 0);
      largeCanvasContext.drawImage(bufferCanvas, 0, 0, imageLength, imageLength,
        0, 0, nodeLength$4 * 3, nodeLength$4 * 3);
      
      let imageDataURL = largeCanvas.toDataURL();
      image.attr('xlink:href', imageDataURL);

      // Destory the buffer canvas
      bufferCanvas.remove();
      largeCanvas.remove();
    };

    /**
     * Create a node group for the intermediate layer
     * @param {number} curLayerIndex Intermediate layer index
     * @param {number} selectedI Clicked node index
     * @param {element} groupLayer Group element
     * @param {number} x Node's x
     * @param {number} y Node's y
     * @param {number} nodeIndex Node's index
     * @param {function} intermediateNodeMouseOverHandler Mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler Mouse leave handler
     * @param {function} intermediateNodeClicked Mouse click handler
     * @param {bool} interaction Whether support interaction
     */
    const createIntermediateNode = (curLayerIndex, selectedI, groupLayer, x, y,
      nodeIndex, stride, intermediateNodeMouseOverHandler,
      intermediateNodeMouseLeaveHandler, intermediateNodeClicked, interaction) => {
      let newNode = groupLayer.append('g')
        .datum(cnn$1[curLayerIndex - 1][nodeIndex])
        .attr('class', 'intermediate-node')
        .attr('cursor', interaction ? 'pointer': 'default')
        .attr('pointer-events', interaction ? 'all': 'none')
        .attr('node-index', nodeIndex)
        .on('mouseover', intermediateNodeMouseOverHandler)
        .on('mouseleave', intermediateNodeMouseLeaveHandler)
        .on('click', (d, g, i) => intermediateNodeClicked(d, g, i, selectedI,
          curLayerIndex));
      
      newNode.append('image')
        .attr('width', nodeLength$4)
        .attr('height', nodeLength$4)
        .attr('x', x)
        .attr('y', y);

      // Overlay the image with a mask of many small rectangles
      let strideTime = Math.floor(nodeLength$4 / stride);
      let overlayGroup = newNode.append('g')
        .attr('class', 'overlay-group')
        .attr('transform', `translate(${x}, ${y})`);
      
      for (let i = 0; i < strideTime; i++) {
        for (let j = 0; j < strideTime; j++) {
          overlayGroup.append('rect')
            .attr('class', `mask-overlay mask-${i}-${j}`)
            .attr('width', stride)
            .attr('height', stride)
            .attr('x', i * stride)
            .attr('y', j * stride)
            .style('fill', 'var(--light-gray)')
            .style('stroke', 'var(--light-gray)')
            .style('opacity', 1);
        }
      }

      // Add a rectangle to show the border
      newNode.append('rect')
        .attr('class', 'bounding')
        .attr('width', nodeLength$4)
        .attr('height', nodeLength$4)
        .attr('x', x)
        .attr('y', y)
        .style('fill', 'none')
        .style('stroke', intermediateColor$1)
        .style('stroke-width', 1);
      
      return newNode;
    };

    const startOutputAnimation = (kernelGroup, tickTime1D, stride, delay,
      curLayerIndex) => {
      const slidingAnimation = () => {
        let originX = +kernelGroup.attr('data-origin-x');
        let originY = +kernelGroup.attr('data-origin-y');
        let oldTick = +kernelGroup.attr('data-tick');
        let i = (oldTick) % tickTime1D;
        let j = Math.floor((oldTick) / tickTime1D);
        let x = originX + i * stride;
        let y = originY + j * stride;
        let newTick = (oldTick + 1) % (tickTime1D * tickTime1D);

        // Remove one mask rect at each tick
        svg$3.selectAll(`rect.mask-${i}-${j}`)
          .transition('window-sliding-mask')
          .delay(delay + 100)
          .duration(300)
          .style('opacity', 0);

          kernelGroup.attr('data-tick', newTick)
          .transition('window-sliding-input')
          .delay(delay)
          .duration(200)
          .attr('transform', `translate(${x}, ${y})`)
          .on('end', () => {
            if (newTick === 0) {
              /* Uncomment to wrap the sliding
              svg.selectAll(`rect.mask-overlay`)
                .transition('window-sliding-mask')
                .delay(delay - 200)
                .duration(300)
                .style('opacity', 1);
              */

              // Stop the animation
              // Be careful with animation racing so call this function here instead
              // of under selectALL
              if (!isEndOfAnimation) {
                animationButtonClicked(curLayerIndex);
              }
            }
            if (shouldIntermediateAnimate) {
              slidingAnimation();
            }
          });
      };
      slidingAnimation();
    };

    const startIntermediateAnimation = (kernelGroupInput, kernelGroupResult,
      tickTime1D, stride) => {
      let delay = 200;
      const slidingAnimation = () => {
        let originX = +kernelGroupInput.attr('data-origin-x');
        let originY = +kernelGroupInput.attr('data-origin-y');
        let originXResult = +kernelGroupResult.attr('data-origin-x');
        let oldTick = +kernelGroupInput.attr('data-tick');
        let i = (oldTick) % tickTime1D;
        let j = Math.floor((oldTick) / tickTime1D);
        let x = originX + i * stride;
        let y = originY + j * stride;
        let xResult = originXResult + (oldTick % tickTime1D) * stride;
        let newTick = (oldTick + 1) % (tickTime1D * tickTime1D);

        // Remove one mask rect at each tick
        svg$3.selectAll(`rect.mask-${i}-${j}`)
          .transition('window-sliding-mask')
          .delay(delay + 100)
          .duration(300)
          .style('opacity', 0);

        kernelGroupInput.attr('data-tick', newTick)
          .transition('window-sliding-input')
          .delay(delay)
          .duration(200)
          .attr('transform', `translate(${x}, ${y})`);

        kernelGroupResult.attr('data-tick', newTick)
          .transition('window-sliding-result')
          .delay(delay)
          .duration(200)
          .attr('transform', `translate(${xResult}, ${y})`)
          .on('end', () => {
            /* Uncomment to wrap the sliding
            if (newTick === 0) {
              svg.selectAll(`rect.mask-overlay`)
                .transition('window-sliding-mask')
                .delay(delay - 200)
                .duration(300)
                .style('opacity', 1);
            }
            */
            if (shouldIntermediateAnimate) {
              slidingAnimation();
            }
          });
      };
      slidingAnimation();
    };

    const animationButtonClicked = (curLayerIndex) => {
      if (d3.event !== null) {
        d3.event.stopPropagation();
      }
      
      let delay = 200;
      let tickTime1D = nodeLength$4 / (kernelRectLength * 3);
      let stride = kernelRectLength * 3; 

      if (isEndOfAnimation) {
        // Start the animation
        shouldIntermediateAnimateStore.set(true);

        // Show kernel
        svg$3.selectAll('.kernel-clone')
          .transition()
          .duration(300)
          .style('opacity', 1);

        // Restore the mask
        svg$3.selectAll(`rect.mask-overlay`)
          .transition()
          .duration(300)
          .style('opacity', 1);

        // Start the intermediate animation
        for (let i  = 0; i < nodeCoordinate$1[curLayerIndex - 1].length; i++) {
          startIntermediateAnimation(d3.select(`.kernel-input-${i}`),
            d3.select(`.kernel-result-${i}`), tickTime1D, stride);
        }

        // Start the output animation
        startOutputAnimation(d3.select('.kernel-output'),
          tickTime1D, stride, delay, curLayerIndex);
        
        // Change the flow edge style
        svg$3.selectAll('path.flow-edge')
          .attr('stroke-dasharray', '4 2')
          .attr('stroke-dashoffset', 0)
          .each((d, i, g) => animateEdge(d, i, g, 0 - 1000));

        // Change button icon
        svg$3.select('.animation-control-button')
          .attr('xlink:href', '/assets/img/fast_forward.svg');
        
        isEndOfAnimation = false;

      } else {
        // End the animation
        shouldIntermediateAnimateStore.set(false);
        
        // Show all intermediate and output results
        svg$3.selectAll(`rect.mask-overlay`)
          .transition('skip')
          .duration(600)
          .style('opacity', 0);
        
        // Move kernel to the beginning to prepare for the next animation
        let kernelClones = svg$3.selectAll('.kernel-clone');
        kernelClones.attr('data-tick', 0)
          .transition('skip')
          .duration(300)
          .style('opacity', 0)
          .on('end', (d, i, g) => {
            let element = d3.select(g[i]);
            let originX = +element.attr('data-origin-x');
            let originY = +element.attr('data-origin-y');
            element.attr('transform', `translate(${originX}, ${originY})`);
          });
        
        // Change flow edge style
        svg$3.selectAll('path.flow-edge')
          .interrupt()
          .attr('stroke-dasharray', '0 0');
        
        // Change button icon
        svg$3.select('.animation-control-button')
          .attr('xlink:href', '/assets/img/redo.svg');
        
        isEndOfAnimation = true;
      }
    };

    const animateEdge = (d, i, g, dashoffset) => {
      let curPath = d3.select(g[i]);
      curPath.transition()
        .duration(60000)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', dashoffset)
        .on('end', (d, i, g) => {
          if (shouldIntermediateAnimate) {
            animateEdge(d, i, g, dashoffset - 2000);
          }
        });
    };

    /**
     * Draw one intermediate layer
     * @param {number} curLayerIndex 
     * @param {number} leftX X value of intermediate layer left border
     * @param {number} rightX X value of intermediate layer right border
     * @param {number} rightStart X value of right component starting anchor
     * @param {number} intermediateGap The inner gap
     * @param {number} d Clicked node bounded data
     * @param {number} i Clicked node index
     * @param {function} intermediateNodeMouseOverHandler Mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler Mouse leave handler
     * @param {function} intermediateNodeClicked Mouse click handler
     */
    const drawIntermediateLayer = (curLayerIndex, leftX, rightX, rightStart,
      intermediateGap, d, i, intermediateNodeMouseOverHandler,
      intermediateNodeMouseLeaveHandler, intermediateNodeClicked) => {
      
      // curRightX = rightStart;

      // Add the intermediate layer
      let intermediateLayer = svg$3.append('g')
        .attr('class', 'intermediate-layer')
        .style('opacity', 0);
      
      // Recovert the animation counter
      isEndOfAnimation = false;
      
      // Tried to add a rectangle to block the intermediate because of webkit's
      // horrible support (decade old bug) for foreignObject. It doesnt work either.
      // https://bugs.webkit.org/show_bug.cgi?id=23113
      // (1). ForeignObject's inside position is wrong on webkit
      // (2). 'opacity' of ForeignObject doesn't work on webkit
      // (3). ForeignObject always show up at the front regardless the svg
      //      stacking order on webkit

      let intermediateX1 = leftX + nodeLength$4 + intermediateGap;
      let intermediateX2 = intermediateX1 + nodeLength$4 + intermediateGap * 1.5;

      let range = cnnLayerRanges$1[selectedScaleLevel$1][curLayerIndex];
      let colorScale = layerColorScales$4[d.type];
      let intermediateMinMax = [];
      
      // Copy the previsious layer to construct foreignObject placeholder
      // Also add edges from/to the intermediate layer in this loop
      let linkData = [];

      // Accumulate the intermediate sum
      // let itnermediateSumMatrix = init2DArray(d.output.length,
      //  d.output.length, 0);

      // Compute the min max of all kernel weights in the intermediate layer
      let kernelExtents = d.inputLinks.map(link => getExtent(link.weight));
      let kernelExtent = kernelExtents.reduce((acc, cur) => {
        return [Math.min(acc[0], cur[0]), Math.max(acc[1], cur[1])];
      });
      let kernelRange = 2 * (Math.round(
        Math.max(...kernelExtent.map(Math.abs)) * 1000) / 1000);
      let kernelColorGap = 0.2;

      // Compute stride for the kernel animation
      let stride = kernelRectLength * 3; 

      // Also add the overlay mask on the output node
      let outputY = nodeCoordinate$1[curLayerIndex][i].y;
      let curNode = svg$3.select(`#layer-${curLayerIndex}-node-${i}`);
      let outputOverlayGroup = curNode.append('g')
        .attr('class', 'overlay-group')
        .attr('transform', `translate(${rightX}, ${outputY})`);

      let strideTime = Math.floor(nodeLength$4 / stride);
      
      for (let i = 0; i < strideTime; i++) {
        for (let j = 0; j < strideTime; j++) {
          outputOverlayGroup.append('rect')
            .attr('class', `mask-overlay mask-${i}-${j}`)
            .attr('width', stride)
            .attr('height', stride)
            .attr('x', i * stride)
            .attr('y', j * stride)
            .style('fill', 'var(--light-gray)')
            .style('stroke', 'var(--light-gray)')
            .style('opacity', 1);
        }
      }

      // Make sure the bounding box is on top of other things
      curNode.select('rect.bounding').raise();

      // Add sliding kernel for the output node
      let kernelGroup = intermediateLayer.append('g')
        .attr('class', `kernel kernel-output kernel-clone`)
        .attr('transform', `translate(${rightX}, ${outputY})`);

      kernelGroup.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', kernelRectLength * 3)
        .attr('height', kernelRectLength * 3)
        .attr('fill', 'none')
        .attr('stroke', intermediateColor$1);
      
      kernelGroup.attr('data-tick', 0)
        .attr('data-origin-x', rightX)
        .attr('data-origin-y', outputY);

      let delay = 200;
      let tickTime1D = nodeLength$4 / (kernelRectLength * 3);

      startOutputAnimation(kernelGroup, tickTime1D, stride, delay, curLayerIndex);

      // First intermediate layer
      nodeCoordinate$1[curLayerIndex - 1].forEach((n, ni) => {

        // Compute the intermediate value
        let inputMatrix = cnn$1[curLayerIndex - 1][ni].output;
        let kernelMatrix = cnn$1[curLayerIndex][i].inputLinks[ni].weight;
        let interMatrix = singleConv(inputMatrix, kernelMatrix);

        // Compute the intermediate layer min max
        intermediateMinMax.push(getExtent(interMatrix));

        // Update the intermediate sum
        // itnermediateSumMatrix = matrixAdd(itnermediateSumMatrix, interMatrix);

        // Layout the canvas and rect
        let newNode = createIntermediateNode(curLayerIndex, i, intermediateLayer,
          intermediateX1, n.y, ni, stride, intermediateNodeMouseOverHandler,
          intermediateNodeMouseLeaveHandler, intermediateNodeClicked, true);
        
        // Draw the image
        let image = newNode.select('image');
        drawIntermidiateImage(image, range, colorScale, d.output.length,
          interMatrix);      

        // Edge: input -> intermediate1
        linkData.push({
          source: getOutputKnot({x: leftX, y: n.y}),
          target: getInputKnot({x: intermediateX1, y: n.y}),
          name: `input-${ni}-inter1-${ni}`
        });

        // Edge: intermediate1 -> intermediate2-1
        linkData.push({
          source: getOutputKnot({x: intermediateX1, y: n.y}),
          target: getInputKnot({x: intermediateX2,
            y: nodeCoordinate$1[curLayerIndex][i].y}),
          name: `inter1-${ni}-inter2-1`
        });

        // Create a small kernel illustration
        // Here we minus 2 because of no padding
        // let tickTime1D = nodeLength / (kernelRectLength) - 2;
        let kernelRectX = leftX - kernelRectLength * 3 * 2;
        let kernelGroup = intermediateLayer.append('g')
          .attr('class', `kernel kernel-${ni}`)
          .attr('transform', `translate(${kernelRectX}, ${n.y})`);

        let weightText = 'Kernel weights: [';
        let f2 = d3.format('.2f');
        for (let r = 0; r < kernelMatrix.length; r++) {
          for (let c = 0; c < kernelMatrix[0].length; c++) {
            kernelGroup.append('rect')
              .attr('class', 'kernel')
              .attr('x', kernelRectLength * c)
              .attr('y', kernelRectLength * r)
              .attr('width', kernelRectLength)
              .attr('height', kernelRectLength)
              .attr('fill', gappedColorScale(layerColorScales$4.weight, kernelRange,
                kernelMatrix[r][c], kernelColorGap));

            let sep = '';
            if (c === 0 && r == 0) { sep = ''; }
            else if (c === 0) { sep = '; '; }
            else { sep = ', '; }
            weightText = weightText.concat(sep, `${f2(kernelMatrix[r][c])}`);
          }
        }
        weightText = weightText.concat(']');

        kernelGroup.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', kernelRectLength * 3)
          .attr('height', kernelRectLength * 3)
          .attr('fill', 'none')
          .attr('stroke', intermediateColor$1);
        
        kernelGroup.style('pointer-events', 'all')
          .style('cursor', 'crosshair')
          .on('mouseover', () => {
            hoverInfoStore.set( {show: true, text: weightText} );
          })
          .on('mouseleave', () => {
            hoverInfoStore.set( {show: false, text: weightText} );
          })
          .on('click', () => {d3.event.stopPropagation();});

        // Sliding the kernel on the input channel and result channel at the same
        // time
        let kernelGroupInput = kernelGroup.clone(true)
          .style('pointer-events', 'none')
          .style('cursor', 'pointer')
          .classed('kernel-clone', true)
          .classed(`kernel-input-${ni}`, true);

        kernelGroupInput.style('opacity', 0.9)
          .selectAll('rect.kernel')
          .style('opacity', 0.7);

        kernelGroupInput.attr('transform', `translate(${leftX}, ${n.y})`)
          .attr('data-tick', 0)
          .attr('data-origin-x', leftX)
          .attr('data-origin-y', n.y);

        let kernelGroupResult = kernelGroup.clone(true)
          .style('pointer-events', 'none')
          .style('cursor', 'pointer')
          .classed('kernel-clone', true)
          .classed(`kernel-result-${ni}`, true);

        kernelGroupResult.style('opacity', 0.9)
          .selectAll('rect.kernel')
          .style('fill', 'none');

        kernelGroupResult.attr('transform',
          `translate(${intermediateX1}, ${n.y})`)
          .attr('data-origin-x', intermediateX1)
          .attr('data-origin-y', n.y);
        
        startIntermediateAnimation(kernelGroupInput, kernelGroupResult, tickTime1D,
          stride);
      });

      // Aggregate the intermediate min max
      let aggregatedExtent = intermediateMinMax.reduce((acc, cur) => {
        return [Math.min(acc[0], cur[0]), Math.max(acc[1], cur[1])];
      });
      let aggregatedMinMax = {min: aggregatedExtent[0], max: aggregatedExtent[1]};

      // Draw the plus operation symbol
      let symbolY = nodeCoordinate$1[curLayerIndex][i].y + nodeLength$4 / 2;
      let symbolRectHeight = 1;
      let symbolGroup = intermediateLayer.append('g')
        .attr('class', 'plus-symbol')
        .attr('transform', `translate(${intermediateX2 + plusSymbolRadius}, ${symbolY})`);
      
      symbolGroup.append('rect')
        .attr('x', -plusSymbolRadius)
        .attr('y', -plusSymbolRadius)
        .attr('width', 2 * plusSymbolRadius)
        .attr('height', 2 * plusSymbolRadius)
        .attr('rx', 3)
        .attr('ry', 3)
        .style('fill', 'none')
        .style('stroke', intermediateColor$1);
      
      symbolGroup.append('rect')
        .attr('x', -(plusSymbolRadius - 3))
        .attr('y', -symbolRectHeight / 2)
        .attr('width', 2 * (plusSymbolRadius - 3))
        .attr('height', symbolRectHeight)
        .style('fill', intermediateColor$1);

      symbolGroup.append('rect')
        .attr('x', -symbolRectHeight / 2)
        .attr('y', -(plusSymbolRadius - 3))
        .attr('width', symbolRectHeight)
        .attr('height', 2 * (plusSymbolRadius - 3))
        .style('fill', intermediateColor$1);

      // Place the bias rectangle below the plus sign if user clicks the firrst
      // conv node
      if (i == 0) {
        // Add bias symbol to the plus symbol
        symbolGroup.append('circle')
            .attr('cx', 0)
            .attr('cy', nodeLength$4 / 2 + kernelRectLength)
            .attr('r', 4)
            .style('stroke', intermediateColor$1)
            .style('cursor', 'crosshair')
            .style('fill', gappedColorScale(layerColorScales$4.weight, kernelRange,
              d.bias, kernelColorGap))
            .on('mouseover', () => {
              hoverInfoStore.set( {show: true, text: `Bias: ${formater$1(d.bias)}`} );
            })
            .on('mouseleave', () => {
              hoverInfoStore.set( {show: false, text: `Bias: ${formater$1(d.bias)}`} );
            });

        // Link from bias to the plus symbol
        linkData.push({
          source: {x: intermediateX2 + plusSymbolRadius,
            y: nodeCoordinate$1[curLayerIndex][i].y + nodeLength$4},
          target: {x: intermediateX2 + plusSymbolRadius,
            y: nodeCoordinate$1[curLayerIndex][i].y + nodeLength$4 / 2 + plusSymbolRadius},
          name: `bias-plus`
        });
      } else {
        // Add bias symbol to the plus symbol
        symbolGroup.append('circle')
          .attr('cx', 0)
          .attr('cy', -nodeLength$4 / 2 - kernelRectLength)
          .attr('r', 4)
          .style('stroke', intermediateColor$1)
          .style('cursor', 'crosshair')
          .style('fill', gappedColorScale(layerColorScales$4.weight, kernelRange,
            d.bias, kernelColorGap))
          .on('mouseover', () => {
            hoverInfoStore.set( {show: true, text: `Bias: ${formater$1(d.bias)}`} );
          })
          .on('mouseleave', () => {
            hoverInfoStore.set( {show: false, text: `Bias: ${formater$1(d.bias)}`} );
          });
        
        // Link from bias to the plus symbol
        linkData.push({
          source: {x: intermediateX2 + plusSymbolRadius,
            y: nodeCoordinate$1[curLayerIndex][i].y},
          target: {x: intermediateX2 + plusSymbolRadius,
            y: nodeCoordinate$1[curLayerIndex][i].y + nodeLength$4 / 2 - plusSymbolRadius},
          name: `bias-plus`
        });
      }

      // Link from the plus symbol to the output
      linkData.push({
        source: getOutputKnot({x: intermediateX2 + 2 * plusSymbolRadius - nodeLength$4,
          y: nodeCoordinate$1[curLayerIndex][i].y}),
        target: getInputKnot({x: rightX,
          y: nodeCoordinate$1[curLayerIndex][i].y}),
        name: `symbol-output`
      });
      
      // Output -> next layer
      linkData.push({
        source: getOutputKnot({x: rightX,
          y: nodeCoordinate$1[curLayerIndex][i].y}),
        target: getInputKnot({x: rightStart,
          y: nodeCoordinate$1[curLayerIndex][i].y}),
        name: `output-next`
      });

      // Draw the layer label
      intermediateLayer.append('g')
        .attr('class', 'layer-intermediate-label layer-label')
        .attr('transform', () => {
          let x = intermediateX1 + nodeLength$4 / 2;
          let y = (svgPaddings$2.top + vSpaceAroundGap$2) / 2 + 5;
          return `translate(${x}, ${y})`;
        })
        .classed('hidden', detailedMode$1)
        .append('text')
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .style('font-weight', 800)
        .style('opacity', '0.8')
        .text('intermediate');
      
      intermediateLayer.append('g')
        .attr('class', 'animation-control')
        .attr('transform', () => {
          let x = intermediateX1 + nodeLength$4 / 2;
          let y = (svgPaddings$2.top + vSpaceAroundGap$2) / 2 - 4;
          return `translate(${x}, ${y})`;
        })
        .on('click', () => animationButtonClicked(curLayerIndex))
        .append('image')
        .attr('class', 'animation-control-button')
        .attr('xlink:href', '/assets/img/fast_forward.svg')
        .attr('x', 50)
        .attr('y', 0)
        .attr('height', 13)
        .attr('width', 13);

      // Draw the detailed model layer label
      intermediateLayer.append('g')
        .attr('class', 'layer-intermediate-label layer-detailed-label')
        .attr('transform', () => {
          let x = intermediateX1 + nodeLength$4 / 2;
          let y = (svgPaddings$2.top + vSpaceAroundGap$2) / 2 - 5;
          return `translate(${x}, ${y})`;
        })
        .classed('hidden', !detailedMode$1)
        .append('text')
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .style('opacity', '0.7')
        .style('font-weight', 800)
        .append('tspan')
        .text('intermediate')
        .append('tspan')
        .style('font-size', '8px')
        .style('font-weight', 'normal')
        .attr('x', 0)
        .attr('dy', '1.5em')
        .text(`(${cnn$1[curLayerIndex][0].output.length},
      ${cnn$1[curLayerIndex][0].output[0].length},
      ${cnn$1[curLayerIndex].length})`);

      // Draw the edges
      let linkGen = d3.linkHorizontal()
        .x(d => d.x)
        .y(d => d.y);
      
      let edgeGroup = intermediateLayer.append('g')
        .attr('class', 'edge-group')
        .lower();
      
      let dashoffset = 0;

      edgeGroup.selectAll('path')
        .data(linkData)
        .enter()
        .append('path')
        .classed('flow-edge', d => d.name !== 'output-next')
        .attr('id', d => `edge-${d.name}`)
        .attr('d', d => linkGen({source: d.source, target: d.target}))
        .style('fill', 'none')
        .style('stroke-width', 1)
        .style('stroke', intermediateColor$1);

      edgeGroup.select('#edge-output-next')
        .style('opacity', 0.1);
      
      edgeGroup.selectAll('path.flow-edge')
        .attr('stroke-dasharray', '4 2')
        .attr('stroke-dashoffset', 0)
        .each((d, i, g) => animateEdge(d, i, g, dashoffset - 1000));
      
      return {intermediateLayer: intermediateLayer,
        intermediateMinMax: aggregatedMinMax,
        kernelRange: kernelRange,
        kernelMinMax: {min: kernelExtent[0], max: kernelExtent[1]}};
    };

    /**
     * Add an annotation for the kernel and the sliding
     * @param {object} arg 
     * {
     *  leftX: X value of the left border of intermedaite layer
     *  group: element group
     *  intermediateGap: the inner gap of intermediate layer
     *  isFirstConv: if this intermediate layer is after the first layer
     *  i: index of the selected node
     * }
     */
    const drawIntermediateLayerAnnotation = (arg) => {
      let leftX = arg.leftX,
        curLayerIndex = arg.curLayerIndex,
        group = arg.group,
        intermediateGap = arg.intermediateGap,
        isFirstConv = arg.isFirstConv,
        i = arg.i;

      let kernelAnnotation = group.append('g')
        .attr('class', 'kernel-annotation');
      
      kernelAnnotation.append('text')
        .text('Kernel')
        .attr('class', 'annotation-text')
        .attr('x', leftX - 2.5 * kernelRectLength * 3)
        .attr('y', nodeCoordinate$1[curLayerIndex - 1][0].y + kernelRectLength * 3)
        .style('dominant-baseline', 'baseline')
        .style('text-anchor', 'end');

      let sliderX, sliderY, arrowSX, arrowSY, dr;
      let sliderX2, sliderY2, arrowSX2, arrowSY2, dr2, arrowTX2, arrowTY2;
      
      if (isFirstConv) {
        sliderX = leftX;
        sliderY = nodeCoordinate$1[curLayerIndex - 1][0].y + nodeLength$4 +
          kernelRectLength * 3;
        arrowSX = leftX - 5;
        arrowSY = nodeCoordinate$1[curLayerIndex - 1][0].y + nodeLength$4 +
          kernelRectLength * 3 + 5;
        dr = 20;
        if(overviewConfig.modeImg > 1) {
          sliderX2 = leftX;
          sliderY2 = nodeCoordinate$1[curLayerIndex - 1][1].y + nodeLength$4 +
              kernelRectLength * 3;
          arrowSX2 = leftX - kernelRectLength * 3;
          arrowSY2 = nodeCoordinate$1[curLayerIndex - 1][1].y + nodeLength$4 + 15;
          arrowTX2 = leftX - 13;
          arrowTY2 = nodeCoordinate$1[curLayerIndex - 1][1].y + 15;
          dr2 = 35;
        }
      } else {
        sliderX = leftX - 3 * kernelRectLength * 3;
        sliderY = nodeCoordinate$1[curLayerIndex - 1][0].y + nodeLength$4 / 3;
        arrowSX = leftX - 2 * kernelRectLength * 3 - 5;
        arrowSY = nodeCoordinate$1[curLayerIndex - 1][0].y + nodeLength$4 - 10;
        dr = 50;

        sliderX2 = leftX - 3 * kernelRectLength * 3;
        sliderY2 = nodeCoordinate$1[curLayerIndex - 1][2].y - 3;
        arrowTX2 = leftX - kernelRectLength * 3 - 4;
        arrowTY2 = nodeCoordinate$1[curLayerIndex - 1][2].y + kernelRectLength * 3 + 6;
        arrowSX2 = leftX - kernelRectLength * 3 - 13;
        arrowSY2 = nodeCoordinate$1[curLayerIndex - 1][2].y + 26;
        dr2 = 20;
      }

      let slideText = kernelAnnotation.append('text')
        .attr('x', sliderX)
        .attr('y', sliderY)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'hanging')
        .style('text-anchor', isFirstConv ? 'start' : 'end');
      
      slideText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text('Slide kernel over input channel');

      slideText.append('tspan')
        .attr('x', sliderX)
        .attr('dy', '1em')
        .style('dominant-baseline', 'hanging')
        .text('to get intermediate result');

      // slideText.append('tspan')
      //   .attr('x', sliderX)
      //   .attr('dy', '1em')
      //   .style('dominant-baseline', 'hanging')
      //   .text('');

      slideText.append('tspan')
        .attr('x', sliderX)
        .attr('dy', '1.2em')
        .style('dominant-baseline', 'hanging')
        .style('font-weight', 700)
        .text('Click ');
      
      slideText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .style('font-weight', 400)
        .text('to learn more');

      drawArrow({
        group: group,
        tx: leftX - 7,
        ty: nodeCoordinate$1[curLayerIndex - 1][0].y + nodeLength$4 / 2,
        sx: arrowSX,
        sy: arrowSY,
        hFlip: !isFirstConv,
        dr: dr,
        marker: 'marker'
      });

      // Add kernel annotation
      let slideText2 = kernelAnnotation.append('text')
        .attr('x', sliderX2)
        .attr('y', sliderY2)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'hanging')
        .style('text-anchor', isFirstConv ? 'start' : 'end');

      slideText2.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text('Each input chanel');

      slideText2.append('tspan')
        .attr('x', sliderX)
        .attr('dy', '1em')
        .style('dominant-baseline', 'hanging')
        .text('gets a different kernel');

      slideText2.append('tspan')
        .attr('x', sliderX)
        .attr('dy', '1.3em')
        .style('font-weight', 700)
        .style('dominant-baseline', 'hanging')
        .text('Hover over ');

      slideText2.append('tspan')
        .style('font-weight', 400)
        .style('dominant-baseline', 'hanging')
        .text('to see value!');

      drawArrow({
        group: group,
        tx: arrowTX2,
        ty: arrowTY2,
        sx: arrowSX2,
        sy: arrowSY2,
        dr: dr2,
        hFlip: !isFirstConv,
        marker: 'marker'
      });


      // Add annotation for the sum operation
      let plusAnnotation = group.append('g')
        .attr('class', 'plus-annotation');
      
      let intermediateX2 = leftX + 2 * nodeLength$4 + 2.5 * intermediateGap;
      let textX = intermediateX2;
      let textY = nodeCoordinate$1[curLayerIndex][i].y + nodeLength$4 +
          kernelRectLength * 3;
      
      // Special case 1: first node
      if (i === 0) { textX += 30; }

      // Special case 2: last node 
      if (i === 9) {
        textX = intermediateX2 + plusSymbolRadius - 10;
        textY -= 2.5 * nodeLength$4;
      }

      let plusText = plusAnnotation.append('text')
        .attr('x', textX)
        .attr('y', textY)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'hanging')
        .style('text-anchor', 'start');
      
      plusText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text('Add up all intermediate');
      
      plusText.append('tspan')
        .attr('x', textX)
        .attr('dy', '1em')
        .style('dominant-baseline', 'hanging')
        .text('results and then add bias');

      if (i === 9) {
        drawArrow({
          group: group,
          sx: intermediateX2 + 50,
          sy: nodeCoordinate$1[curLayerIndex][i].y - (nodeLength$4 / 2 + kernelRectLength * 2),
          tx: intermediateX2 + 2 * plusSymbolRadius + 5,
          ty: nodeCoordinate$1[curLayerIndex][i].y + nodeLength$4 / 2 - plusSymbolRadius,
          dr: 50,
          hFlip: false,
          marker: 'marker-alt'
        });
      } else {
        drawArrow({
          group: group,
          sx: intermediateX2 + 35,
          sy: nodeCoordinate$1[curLayerIndex][i].y + nodeLength$4 + kernelRectLength * 2,
          tx: intermediateX2 + 2 * plusSymbolRadius + 5,
          ty: nodeCoordinate$1[curLayerIndex][i].y + nodeLength$4 / 2 + plusSymbolRadius,
          dr: 30,
          hFlip: true,
          marker: 'marker-alt'
        });
      }

      // Add annotation for the bias
      let biasTextY = nodeCoordinate$1[curLayerIndex][i].y;
      if (i === 0) {
        biasTextY += nodeLength$4 + 3 * kernelRectLength;
      } else {
        biasTextY -= 2 * kernelRectLength + 5;
      }
      plusAnnotation.append('text')
        .attr('class', 'annotation-text')
        .attr('x', intermediateX2 + plusSymbolRadius)
        .attr('y', biasTextY)
        .style('text-anchor', 'middle')
        .style('dominant-baseline', i === 0 ? 'hanging' : 'baseline')
        .text('Bias');
    };

    /**
     * Append a filled rectangle under a pair of nodes.
     * @param {number} curLayerIndex Index of the selected layer
     * @param {number} i Index of the selected node
     * @param {number} leftX X value of the left border of intermediate layer
     * @param {number} intermediateGap Inner gap of this intermediate layer
     * @param {number} padding Padding around the rect
     * @param {function} intermediateNodeMouseOverHandler Mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler Mouse leave handler
     * @param {function} intermediateNodeClicked Mouse click handler
     */
    const addUnderneathRect = (curLayerIndex, i, leftX,
      intermediateGap, padding, intermediateNodeMouseOverHandler,
      intermediateNodeMouseLeaveHandler, intermediateNodeClicked) => {
      // Add underneath rects
      let underGroup = svg$3.select('g.underneath');

      for (let n = 0; n < cnn$1[curLayerIndex - 1].length; n++) {
        underGroup.append('rect')
          .attr('class', 'underneath-gateway')
          .attr('id', `underneath-gateway-${n}`)
          .attr('x', leftX - padding)
          .attr('y', nodeCoordinate$1[curLayerIndex - 1][n].y - padding)
          .attr('width', (2 * nodeLength$4 + intermediateGap) + 2 * padding)
          .attr('height', nodeLength$4 + 2 * padding)
          .attr('rx', 10)
          .style('fill', 'rgba(160, 160, 160, 0.2)')
          .style('opacity', 0);
        
        // Register new events for input layer nodes
        svg$3.select(`g#layer-${curLayerIndex - 1}-node-${n}`)
          .style('pointer-events', 'all')
          .style('cursor', 'pointer')
          .on('mouseover', intermediateNodeMouseOverHandler)
          .on('mouseleave', intermediateNodeMouseLeaveHandler)
          .on('click', (d, ni, g) => intermediateNodeClicked(d, ni, g,
            i, curLayerIndex));
          // .on('click', (d, i) => {console.log(i)});
      }
      underGroup.lower();
    };

    /**
     * Add an overlaying rect
     * @param {string} gradientName Gradient name of overlay rect
     * @param {number} x X value of the overlaying rect
     * @param {number} y Y value of the overlaying rect
     * @param {number} width Rect width
     * @param {number} height Rect height
     */
    const addOverlayRect = (gradientName, x, y, width, height) => {
      if (svg$3.select('.intermediate-layer-overlay').empty()) {
        svg$3.append('g').attr('class', 'intermediate-layer-overlay');
      }

      let intermediateLayerOverlay = svg$3.select('.intermediate-layer-overlay');

      let overlayRect = intermediateLayerOverlay.append('rect')
        .attr('class', 'overlay')
        .style('fill', `url(#${gradientName})`)
        .style('stroke', 'none')
        .attr('width', width)
        .attr('height', height)
        .attr('x', x)
        .attr('y', y)
        .style('opacity', 0);
      
      overlayRect.transition('move')
        .duration(800)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /**
     * Redraw the layer if needed (entering the intermediate view to make sure
     * all layers have the same color scale)
     * @param {number} curLayerIndex Index of the selected layer
     * @param {number} i Index of the selected node
     */
    const redrawLayerIfNeeded = (curLayerIndex, i) => {
      // Determine the range for this layerview, and redraw the layer with
      // smaller range so all layers have the same range
      let rangePre = cnnLayerRanges$1[selectedScaleLevel$1][curLayerIndex - 1];
      let rangeCur = cnnLayerRanges$1[selectedScaleLevel$1][curLayerIndex];
      let range = Math.max(rangePre, rangeCur);

      if (rangePre > rangeCur) {
        // Redraw the current layer (selected node)
        svg$3.select(`g#layer-${curLayerIndex}-node-${i}`)
          .select('image.node-image')
          .each((d, g, i) => drawOutput(d, g, i, range));
        
        // Record the change so we will re-redraw the layer when user quits
        // the intermediate view
        needRedraw = [curLayerIndex, i];
        needRedrawStore.set(needRedraw);
        
      } else if (rangePre < rangeCur) {
        // Redraw the previous layer (whole layer)
        svg$3.select(`g#cnn-layer-group-${curLayerIndex - 1}`)
          .selectAll('image.node-image')
          .each((d, g, i) => drawOutput(d, g, i, range));

        // Record the change so we will re-redraw the layer when user quits
        // the intermediate view
        needRedraw = [curLayerIndex - 1, undefined];
        needRedrawStore.set(needRedraw);
      }

      // Compute the min, max value of all nodes in pre-layer and the selected
      // node of cur-layer
      let min = cnnLayerMinMax$1[curLayerIndex - 1].min,
        max = cnnLayerMinMax$1[curLayerIndex - 1].max;

      // Selected node
      let n = cnn$1[curLayerIndex][i];
      for (let r = 0; r < n.output.length; r++) {
        for (let c = 0; c < n.output[0].length; c++) {
          if (n.output[r][c] < min) { min = n.output[r][c]; }
          if (n.output[r][c] > max) { max = n.output[r][c]; }
        }
      }

      return {range: range, minMax: {min: min, max: max}};
    };

    /**
     * Draw the intermediate layer before conv_1_1
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     * @param {function} intermediateNodeMouseOverHandler mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler mouse leave handler
     * @param {function} intermediateNodeClicked node clicking handler
     */
    const drawConv1 = (curLayerIndex, d, i, width, height,
      intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
      intermediateNodeClicked) => {
      // Compute the target location
      let targetX = nodeCoordinate$1[curLayerIndex - 1][0].x + 2 * nodeLength$4 +
        2 * hSpaceAroundGap$1 * gapRatio$1 + plusSymbolRadius * 2;
      let intermediateGap = (hSpaceAroundGap$1 * gapRatio$1 * 2) / 3;
      let leftX = nodeCoordinate$1[curLayerIndex - 1][0].x;

      // Record the left x position for dynamic detial view positioning
      intermediateLayerPosition['conv_1_1'] = targetX + nodeLength$4;
      intermediateLayerPositionStore.set(intermediateLayerPosition);

      // Hide the edges
      svg$3.select('g.edge-group')
        .style('visibility', 'hidden');

      // Move the selected layer
      moveLayerX({layerIndex: curLayerIndex, targetX: targetX, disable: true,
        delay: 0, opacity: 0.15, specialIndex: i});

      // Compute the gap in the right shrink region
      let rightStart = targetX + nodeLength$4 + hSpaceAroundGap$1 * gapRatio$1;
      let rightGap = (width - rightStart - 10 * nodeLength$4) / 10;

      // Move the right layers
      for (let i = curLayerIndex + 1; i < numLayers$1; i++) {
        let curX = rightStart + (i - (curLayerIndex + 1)) * (nodeLength$4 + rightGap);
        moveLayerX({layerIndex: i, targetX: curX, disable: true, delay: 0});
      }

      // Add an overlay gradient and rect
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
      {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
      {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}];
      addOverlayGradient('overlay-gradient', stops);

      addOverlayRect('overlay-gradient', rightStart - overlayRectOffset / 2,
      0, width - rightStart + overlayRectOffset,
      height + svgPaddings$2.top + svgPaddings$2.bottom);

      // Draw the intermediate layer
      let {intermediateLayer, intermediateMinMax, kernelRange, kernelMinMax} =
      drawIntermediateLayer(curLayerIndex, leftX, targetX, rightStart,
        intermediateGap, d, i, intermediateNodeMouseOverHandler,
        intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
      addUnderneathRect(curLayerIndex, i, leftX, intermediateGap, 8,
        intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
        intermediateNodeClicked);

      // Compute the selected node's min max
      // Selected node
      let min = Infinity, max = -Infinity;
      let n = cnn$1[curLayerIndex][i];
      for (let r = 0; r < n.output.length; r++) {
      for (let c = 0; c < n.output[0].length; c++) {
        if (n.output[r][c] < min) { min = n.output[r][c]; }
        if (n.output[r][c] > max) { max = n.output[r][c]; }
      }
      }

      let finalMinMax = {
      min: Math.min(min, intermediateMinMax.min),
      max: Math.max(max, intermediateMinMax.max)
      };

      // Add annotation to the intermediate layer
      let intermediateLayerAnnotation = svg$3.append('g')
      .attr('class', 'intermediate-layer-annotation')
      .style('opacity', 0);

      drawIntermediateLayerAnnotation({
        leftX: leftX,
        curLayerIndex: curLayerIndex,
        group: intermediateLayerAnnotation,
        intermediateGap: intermediateGap,
        isFirstConv: true,
        i: i
      });

      let range = cnnLayerRanges$1.local[curLayerIndex];

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: 1,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        isInput: true,
        x: leftX,
        y: svgPaddings$2.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 + 
          nodeLength$4 * 10 - 25
      });
      if(overviewConfig.modeImg > 1) {
        drawIntermediateLayerLegend({
          legendHeight: 5,
          curLayerIndex: curLayerIndex,
          range: range,
          minMax: finalMinMax,
          group: intermediateLayer,
          width: 2 * nodeLength$4 + intermediateGap,
          x: nodeCoordinate$1[curLayerIndex - 1][2].x,
          y: svgPaddings$2.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 +
              nodeLength$4 * 10
        });

        drawIntermediateLayerLegend({
          legendHeight: 5,
          curLayerIndex: curLayerIndex,
          range: kernelRange,
          minMax: kernelMinMax,
          group: intermediateLayer,
          width: 2 * nodeLength$4 + intermediateGap,
          x: targetX + nodeLength$4 - (2 * nodeLength$4 + intermediateGap),
          y: svgPaddings$2.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 +
              nodeLength$4 * 10,
          gradientAppendingName: 'kernelColorGradient',
          colorScale: layerColorScales$4.weight,
          gradientGap: 0.2
        });
      }
      // Show everything
      svg$3.selectAll('g.intermediate-layer, g.intermediate-layer-annotation')
        .transition()
        .delay(500)
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /**
     * Draw the intermediate layer before conv_1_2
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     * @param {function} intermediateNodeMouseOverHandler mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler mouse leave handler
     * @param {function} intermediateNodeClicked node clicking handler
     */
    const drawConv2 = (curLayerIndex, d, i, width, height,
      intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
      intermediateNodeClicked) => {
      let targetX = nodeCoordinate$1[curLayerIndex - 1][0].x + 2 * nodeLength$4 +
        2 * hSpaceAroundGap$1 * gapRatio$1 + plusSymbolRadius * 2;
      let intermediateGap = (hSpaceAroundGap$1 * gapRatio$1 * 2) / 3;

      // Record the left x position for dynamic detial view positioning
      intermediateLayerPosition['conv_1_2'] = targetX + nodeLength$4;
      intermediateLayerPositionStore.set(intermediateLayerPosition);

      // Make sure two layers have the same range
      let {range, minMax} = redrawLayerIfNeeded(curLayerIndex, i);

      // Hide the edges
      svg$3.select('g.edge-group')
        .style('visibility', 'hidden');

      // Move the selected layer
      moveLayerX({layerIndex: curLayerIndex, targetX: targetX, disable: true,
        delay: 0, opacity: 0.15, specialIndex: i});

      // Compute the gap in the right shrink region
      let rightStart = targetX + nodeLength$4 + hSpaceAroundGap$1 * gapRatio$1;
      let rightGap = (width - rightStart - 8 * nodeLength$4) / 8;

      // Move the right layers
      for (let i = curLayerIndex + 1; i < numLayers$1; i++) {
        let curX = rightStart + (i - (curLayerIndex + 1)) * (nodeLength$4 + rightGap);
        moveLayerX({layerIndex: i, targetX: curX, disable: true, delay: 0});
      }

      // Add an overlay
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}];
      addOverlayGradient('overlay-gradient-right', stops);

      let leftRightRatio = (2 * nodeLength$4 + hSpaceAroundGap$1 * gapRatio$1) /
        (8 * nodeLength$4 + intermediateGap * 7);
      let endingGradient = 0.85 + (0.95 - 0.85) * leftRightRatio;
      stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: endingGradient},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.85}];
      addOverlayGradient('overlay-gradient-left', stops);

      addOverlayRect('overlay-gradient-right', rightStart - overlayRectOffset / 2,
        0, width - rightStart + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);

      addOverlayRect('overlay-gradient-left', nodeCoordinate$1[0][0].x - overlayRectOffset / 2,
        0, nodeLength$4 * 2 + hSpaceAroundGap$1 * gapRatio$1 + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);

      // Draw the intermediate layer
      let leftX = nodeCoordinate$1[curLayerIndex - 1][0].x;
      let {intermediateLayer, intermediateMinMax, kernelRange, kernelMinMax} =
        drawIntermediateLayer(curLayerIndex, leftX, targetX, rightStart,
          intermediateGap, d, i, intermediateNodeMouseOverHandler,
          intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
      addUnderneathRect(curLayerIndex, i, leftX, intermediateGap, 5,
        intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
        intermediateNodeClicked);

      // After getting the intermediateMinMax, we can finally aggregate it with
      // the preLayer minmax, curLayer minmax
      let finalMinMax = {
        min: Math.min(minMax.min, intermediateMinMax.min),
        max: Math.max(minMax.max, intermediateMinMax.max)
      };

      // Add annotation to the intermediate layer
      let intermediateLayerAnnotation = svg$3.append('g')
        .attr('class', 'intermediate-layer-annotation')
        .style('opacity', 0);

      drawIntermediateLayerAnnotation({
        leftX: leftX,
        curLayerIndex: curLayerIndex,
        group: intermediateLayerAnnotation,
        intermediateGap: intermediateGap,
        i: i
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: range,
        minMax: finalMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: leftX,
        y: svgPaddings$2.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 + 
          nodeLength$4 * 10
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: kernelRange,
        minMax: kernelMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: targetX + nodeLength$4 - (2 * nodeLength$4 + intermediateGap),
        y: svgPaddings$2.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 + 
          nodeLength$4 * 10,
        gradientAppendingName: 'kernelColorGradient',
        colorScale: layerColorScales$4.weight,
        gradientGap: 0.2
      });

      // Show everything
      svg$3.selectAll('g.intermediate-layer, g.intermediate-layer-annotation')
        .transition()
        .delay(500)
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /**
     * Draw the intermediate layer before conv_2_1
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     * @param {function} intermediateNodeMouseOverHandler mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler mouse leave handler
     * @param {function} intermediateNodeClicked node clicking handler
     */
    const drawConv3 = (curLayerIndex, d, i, width, height,
      intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
      intermediateNodeClicked) => {

      let targetX = nodeCoordinate$1[curLayerIndex][0].x;
      let leftX = targetX - (2 * nodeLength$4 +
        2 * hSpaceAroundGap$1 * gapRatio$1 + plusSymbolRadius * 2);
      let intermediateGap = (hSpaceAroundGap$1 * gapRatio$1 * 2) / 3;

      // Record the left x position for dynamic detial view positioning
      intermediateLayerPosition['conv_2_1'] = targetX + nodeLength$4;
      intermediateLayerPositionStore.set(intermediateLayerPosition);

      // Hide the edges
      svg$3.select('g.edge-group')
        .style('visibility', 'hidden');

      // Make sure two layers have the same range
      let {range, minMax} = redrawLayerIfNeeded(curLayerIndex, i);

      // Move the previous layer
      moveLayerX({layerIndex: curLayerIndex - 1, targetX: leftX,
        disable: true, delay: 0});

      moveLayerX({layerIndex: curLayerIndex,
        targetX: targetX, disable: true,
        delay: 0, opacity: 0.15, specialIndex: i});

      // Compute the gap in the left shrink region
      let leftEnd = leftX - hSpaceAroundGap$1;
      let leftGap = (leftEnd - nodeCoordinate$1[0][0].x - 5 * nodeLength$4) / 5;
      let rightStart = nodeCoordinate$1[curLayerIndex][0].x +
        nodeLength$4 + hSpaceAroundGap$1;

      // Move the left layers
      for (let i = 0; i < curLayerIndex - 1; i++) {
        let curX = nodeCoordinate$1[0][0].x + i * (nodeLength$4 + leftGap);
        moveLayerX({layerIndex: i, targetX: curX, disable: true, delay: 0});
      }

      // Add an overlay
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 1},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.9},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.85}];
      addOverlayGradient('overlay-gradient-left', stops);

      stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}];
      addOverlayGradient('overlay-gradient-right', stops);

      addOverlayRect('overlay-gradient-left', nodeCoordinate$1[0][0].x - overlayRectOffset / 2,
        0, leftEnd - nodeCoordinate$1[0][0].x + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);
      
      addOverlayRect('overlay-gradient-right', rightStart - overlayRectOffset / 2,
        0, width - rightStart + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);
      
      // Draw the intermediate layer
      let {intermediateLayer, intermediateMinMax, kernelRange, kernelMinMax} =
        drawIntermediateLayer(curLayerIndex, leftX,
          nodeCoordinate$1[curLayerIndex][0].x, rightStart, intermediateGap,
          d, i, intermediateNodeMouseOverHandler,
          intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
      addUnderneathRect(curLayerIndex, i, leftX, intermediateGap, 5,
        intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
        intermediateNodeClicked);
              
      // After getting the intermediateMinMax, we can finally aggregate it with
      // the preLayer minmax, curLayer minmax
      let finalMinMax = {
        min: Math.min(minMax.min, intermediateMinMax.min),
        max: Math.max(minMax.max, intermediateMinMax.max)
      };

      // Add annotation to the intermediate layer
      let intermediateLayerAnnotation = svg$3.append('g')
        .attr('class', 'intermediate-layer-annotation')
        .style('opacity', 0);

      drawIntermediateLayerAnnotation({
        leftX: leftX,
        curLayerIndex: curLayerIndex,
        group: intermediateLayerAnnotation,
        intermediateGap: intermediateGap,
        i: i
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: range,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        minMax: finalMinMax,
        x: leftX,
        y: svgPaddings$2.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 + 
          nodeLength$4 * 10
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: kernelRange,
        minMax: kernelMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: targetX + nodeLength$4 - (2 * nodeLength$4 + intermediateGap),
        y: svgPaddings$2.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 + 
          nodeLength$4 * 10,
        gradientAppendingName: 'kernelColorGradient',
        colorScale: layerColorScales$4.weight,
        gradientGap: 0.2
      });

      // Show everything
      svg$3.selectAll('g.intermediate-layer, g.intermediate-layer-annotation')
        .transition()
        .delay(500)
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /**
     * Draw the intermediate layer before conv_2_2
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     * @param {function} intermediateNodeMouseOverHandler mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler mouse leave handler
     * @param {function} intermediateNodeClicked node clicking handler
     */
    const drawConv4 = (curLayerIndex, d, i, width, height,
      intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
      intermediateNodeClicked) => {
      let targetX = nodeCoordinate$1[curLayerIndex][0].x;
      let leftX = targetX - (2 * nodeLength$4 +
        2 * hSpaceAroundGap$1 * gapRatio$1 + plusSymbolRadius * 2);
      let intermediateGap = (hSpaceAroundGap$1 * gapRatio$1 * 2) / 3;

      // Record the left x position for dynamic detial view positioning
      intermediateLayerPosition['conv_2_2'] = leftX;
      intermediateLayerPositionStore.set(intermediateLayerPosition);

      // Hide the edges
      svg$3.select('g.edge-group')
        .style('visibility', 'hidden');

      // Make sure two layers have the same range
      let {range, minMax} = redrawLayerIfNeeded(curLayerIndex, i);

      // Move the previous layer
      moveLayerX({layerIndex: curLayerIndex - 1, targetX: leftX,
        disable: true, delay: 0});

      moveLayerX({layerIndex: curLayerIndex,
        targetX: targetX, disable: true,
        delay: 0, opacity: 0.15, specialIndex: i});

      // Compute the gap in the left shrink region
      let leftEnd = leftX - hSpaceAroundGap$1;
      let leftGap = (leftEnd - nodeCoordinate$1[0][0].x - 7 * nodeLength$4) / 7;
      let rightStart = targetX + nodeLength$4 + hSpaceAroundGap$1;

      // Move the left layers
      for (let i = 0; i < curLayerIndex - 1; i++) {
        let curX = nodeCoordinate$1[0][0].x + i * (nodeLength$4 + leftGap);
        moveLayerX({layerIndex: i, targetX: curX, disable: true, delay: 0});
      }

      // Add an overlay
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 1},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.85}];
      addOverlayGradient('overlay-gradient-left', stops);

      stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}];
      addOverlayGradient('overlay-gradient-right', stops);

      addOverlayRect('overlay-gradient-left', nodeCoordinate$1[0][0].x - overlayRectOffset / 2,
        0, leftEnd - nodeCoordinate$1[0][0].x + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);
      
      addOverlayRect('overlay-gradient-right', rightStart - overlayRectOffset / 2,
        0, width - rightStart + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);
      
      // Draw the intermediate layer
      let {intermediateLayer, intermediateMinMax, kernelRange, kernelMinMax} =
        drawIntermediateLayer(curLayerIndex, leftX,
          nodeCoordinate$1[curLayerIndex][0].x, rightStart, intermediateGap,
          d, i, intermediateNodeMouseOverHandler,
          intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
      addUnderneathRect(curLayerIndex, i, leftX, intermediateGap, 5,
        intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
        intermediateNodeClicked);
              
      // After getting the intermediateMinMax, we can finally aggregate it with
      // the preLayer minmax, curLayer minmax
      let finalMinMax = {
        min: Math.min(minMax.min, intermediateMinMax.min),
        max: Math.max(minMax.max, intermediateMinMax.max)
      };

      // Add annotation to the intermediate layer
      let intermediateLayerAnnotation = svg$3.append('g')
        .attr('class', 'intermediate-layer-annotation')
        .style('opacity', 0);

      drawIntermediateLayerAnnotation({
        leftX: leftX,
        curLayerIndex: curLayerIndex,
        group: intermediateLayerAnnotation,
        intermediateGap: intermediateGap,
        i: i
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: range,
        group: intermediateLayer,
        minMax: finalMinMax,
        width: 2 * nodeLength$4 + intermediateGap,
        x: leftX,
        y: svgPaddings$2.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 + 
          nodeLength$4 * 10
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: kernelRange,
        minMax: kernelMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: targetX + nodeLength$4 - (2 * nodeLength$4 + intermediateGap),
        y: svgPaddings$2.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 + 
          nodeLength$4 * 10,
        gradientAppendingName: 'kernelColorGradient',
        colorScale: layerColorScales$4.weight,
        gradientGap: 0.2
      });

      // Show everything
      svg$3.selectAll('g.intermediate-layer, g.intermediate-layer-annotation')
        .transition()
        .delay(500)
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /* global d3, SmoothScroll */

    // Configs
    const layerColorScales$5 = overviewConfig.layerColorScales;
    const nodeLength$5 = overviewConfig.nodeLength;
    const plusSymbolRadius$1 = overviewConfig.plusSymbolRadius;
    const intermediateColor$2 = overviewConfig.intermediateColor;
    const kernelRectLength$1 = overviewConfig.kernelRectLength;
    const svgPaddings$3 = overviewConfig.svgPaddings;
    const gapRatio$2 = overviewConfig.gapRatio;
    const classList = overviewConfig.classLists;
    const formater$2 = d3.format('.4f');

    // Shared variables
    let svg$4 = undefined;
    svgStore.subscribe( value => {svg$4 = value;} );

    let vSpaceAroundGap$3 = undefined;
    vSpaceAroundGapStore.subscribe( value => {vSpaceAroundGap$3 = value;} );

    let hSpaceAroundGap$2 = undefined;
    hSpaceAroundGapStore.subscribe( value => {hSpaceAroundGap$2 = value;} );

    let cnn$2 = undefined;
    cnnStore.subscribe( value => {cnn$2 = value;} );

    let nodeCoordinate$2 = undefined;
    nodeCoordinateStore.subscribe( value => {nodeCoordinate$2 = value;} );

    let selectedScaleLevel$2 = undefined;
    selectedScaleLevelStore.subscribe( value => {selectedScaleLevel$2 = value;} );

    let cnnLayerRanges$2 = undefined;
    cnnLayerRangesStore.subscribe( value => {cnnLayerRanges$2 = value;} );

    let cnnLayerMinMax$2 = undefined;
    cnnLayerMinMaxStore.subscribe( value => {cnnLayerMinMax$2 = value;} );

    let isInSoftmax = undefined;
    isInSoftmaxStore.subscribe( value => {isInSoftmax = value;} );

    let allowsSoftmaxAnimation = undefined;
    allowsSoftmaxAnimationStore.subscribe( value => {allowsSoftmaxAnimation = value;} );

    let softmaxDetailViewInfo = undefined;
    softmaxDetailViewStore.subscribe( value => {softmaxDetailViewInfo = value;} );

    let hoverInfo = undefined;
    hoverInfoStore.subscribe( value => {hoverInfo = value;} );

    let detailedMode$2 = undefined;
    detailedModeStore.subscribe( value => {detailedMode$2 = value;} );

    let layerIndexDict = {
      'input': 0,
      'conv_1_1': 1,
      'relu_1_1': 2,
      'conv_1_2': 3,
      'relu_1_2': 4,
      'max_pool_1': 5,
      'conv_2_1': 6,
      'relu_2_1': 7,
      'conv_2_2': 8,
      'relu_2_2': 9,
      'max_pool_2': 10,
      'output': 11
    };

    let hasInitialized = false;
    let logits = [];
    let flattenFactoredFDict = {};

    const moveLegend = (d, i, g, moveX, duration, restore) => {
      let legend = d3.select(g[i]);

      if (!restore) {
        let previousTransform = legend.attr('transform');
        let previousLegendX = +previousTransform.replace(/.*\(([\d\.]+),.*/, '$1');
        let previousLegendY = +previousTransform.replace(/.*,\s([\d\.]+)\)/, '$1');
      
        legend.transition('softmax')
          .duration(duration)
          .ease(d3.easeCubicInOut)
          .attr('transform', `translate(${previousLegendX - moveX}, ${previousLegendY})`);
        
        // If not in restore mode, we register the previous location to the DOM element
        legend.attr('data-preX', previousLegendX);
        legend.attr('data-preY', previousLegendY);
      } else {
        // Restore the recorded location
        let previousLegendX = +legend.attr('data-preX');
        let previousLegendY = +legend.attr('data-preY');

        legend.transition('softmax')
          .duration(duration)
          .ease(d3.easeCubicInOut)
          .attr('transform', `translate(${previousLegendX}, ${previousLegendY})`);
      }
    };

    const logitCircleMouseOverHandler = (i) => {
      // Update the hover info UI
      hoverInfoStore.set({
        show: true,
        text: `Logit: ${formater$2(logits[i])}`
      });

      // Highlight the text in the detail view
      softmaxDetailViewInfo.highlightI = i;
      softmaxDetailViewStore.set(softmaxDetailViewInfo);

      let logitLayer = svg$4.select('.logit-layer');
      let logitLayerLower = svg$4.select('.underneath');
      let intermediateLayer = svg$4.select('.intermediate-layer');

      // Highlight the circle
      logitLayer.select(`#logit-circle-${i}`)
        .style('stroke-width', 2);

      // Highlight the associated plus symbol
      intermediateLayer.select(`#plus-symbol-clone-${i}`)
        .style('opacity', 1)
        .select('circle')
        .style('fill', d => d.fill);
      
      // Raise the associated edge group
      logitLayerLower.select(`#logit-lower-${i}`).raise();

      // Highlight the associated edges
      logitLayerLower.selectAll(`.softmax-abstract-edge-${i}`)
        .style('stroke-width', 0.8)
        .style('stroke', '#E0E0E0');

      logitLayerLower.selectAll(`.softmax-edge-${i}`)
        .style('stroke-width', 1)
        .style('stroke', '#E0E0E0');
      
      logitLayerLower.selectAll(`.logit-output-edge-${i}`)
        .style('stroke-width', 3)
        .style('stroke', '#E0E0E0');

      logitLayer.selectAll(`.logit-output-edge-${i}`)
        .style('stroke-width', 3)
        .style('stroke', '#E0E0E0');
    };

    const logitCircleMouseLeaveHandler = (i) => {
      // screenshot
      // return;

      // Update the hover info UI
      hoverInfoStore.set({
        show: false,
        text: `Logit: ${formater$2(logits[i])}`
      });

      // Dehighlight the text in the detail view
      softmaxDetailViewInfo.highlightI = -1;
      softmaxDetailViewStore.set(softmaxDetailViewInfo);

      let logitLayer = svg$4.select('.logit-layer');
      let logitLayerLower = svg$4.select('.underneath');
      let intermediateLayer = svg$4.select('.intermediate-layer');

      // Restore the circle
      logitLayer.select(`#logit-circle-${i}`)
        .style('stroke-width', 1);

      // Restore the associated plus symbol
      intermediateLayer.select(`#plus-symbol-clone-${i}`)
        .style('opacity', 0.2);

      // Restore the associated edges
      logitLayerLower.selectAll(`.softmax-abstract-edge-${i}`)
        .style('stroke-width', 0.2)
        .style('stroke', '#EDEDED');

      logitLayerLower.selectAll(`.softmax-edge-${i}`)
        .style('stroke-width', 0.2)
        .style('stroke', '#F1F1F1');

      logitLayerLower.selectAll(`.logit-output-edge-${i}`)
        .style('stroke-width', 1.2)
        .style('stroke', '#E5E5E5');
      
      logitLayer.selectAll(`.logit-output-edge-${i}`)
        .style('stroke-width', 1.2)
        .style('stroke', '#E5E5E5');
    };

    // This function is binded to the detail view in Cnn.svelte
    const softmaxDetailViewMouseOverHandler = (event) => {
      logitCircleMouseOverHandler(event.detail.curI);
    };

    // This function is binded to the detail view in Cnn.svelte
    const softmaxDetailViewMouseLeaveHandler = (event) => {
      logitCircleMouseLeaveHandler(event.detail.curI);
    };

    const drawLogitLayer = (arg) => {
      let curLayerIndex = arg.curLayerIndex,
        moveX = arg.moveX,
        softmaxLeftMid = arg.softmaxLeftMid,
        selectedI = arg.selectedI,
        intermediateX1 = arg.intermediateX1,
        intermediateX2 = arg.intermediateX2,
        pixelWidth = arg.pixelWidth,
        pixelHeight = arg.pixelHeight,
        topY = arg.topY,
        bottomY = arg.bottomY,
        softmaxX = arg.softmaxX,
        middleGap = arg.middleGap,
        middleRectHeight = arg.middleRectHeight,
        symbolGroup = arg.symbolGroup,
        symbolX = arg.symbolX,
        flattenRange = arg.flattenRange;

      let logitLayer = svg$4.select('.intermediate-layer')
        .append('g')
        .attr('class', 'logit-layer')
        .raise();
      
      // Minotr layer ordering change
      let tempClone = svg$4.select('.intermediate-layer')
        .select('.flatten-layer')
        .select('.plus-symbol')
        .clone(true)
        .attr('class', 'temp-clone-plus-symbol')
        .attr('transform', `translate(${symbolX - moveX},
      ${nodeCoordinate$2[curLayerIndex][selectedI].y + nodeLength$5 / 2})`)
        // Cool hack -> d3 clone doesnt clone events, make the front object pointer
        // event transparent so users can trigger the underlying object's event!
        .style('pointer-events', 'none')
        .remove();

      let tempPlusSymbol = logitLayer.append(() => tempClone.node());
      
      svg$4.select('.softmax-symbol').raise();

      let logitLayerLower = svg$4.select('.underneath')
        .append('g')
        .attr('class', 'logit-layer-lower')
        .lower();
      
      // Use circles to encode logit values
      let centerX = softmaxLeftMid - moveX * 4 / 5;

      // Get all logits
      logits = [];
      for (let i = 0; i < cnn$2[layerIndexDict['output']].length; i++) {
        logits.push(cnn$2[layerIndexDict['output']][i].logit);
      }

      // Construct a color scale for the logit values
      let logitColorScale = d3.scaleLinear()
        .domain(d3.extent(logits))
        .range([0.2, 1]);
      
      // Draw the current logit circle before animation
      let logitRadius = 8;
      logitLayer.append('circle')
        .attr('class', 'logit-circle')
        .attr('id', `logit-circle-${selectedI}`)
        .attr('cx', centerX)
        .attr('cy', nodeCoordinate$2[curLayerIndex - 1][selectedI].y + nodeLength$5 / 2)
        .attr('r', logitRadius)
        .style('fill', layerColorScales$5.logit(logitColorScale(logits[selectedI])))
        .style('cursor', 'crosshair')
        .style('pointer-events', 'all')
        .style('stroke', intermediateColor$2)
        .on('mouseover', () => logitCircleMouseOverHandler(selectedI))
        .on('mouseleave', () => logitCircleMouseLeaveHandler(selectedI))
        .on('click', () => { d3.event.stopPropagation(); });
      
      // Show the logit circle corresponding label
      let softmaxDetailAnnotation = svg$4.select('.intermediate-layer-annotation')
        .select('.softmax-detail-annoataion');

      softmaxDetailAnnotation.select(`#logit-text-${selectedI}`)
        .style('opacity', 1);

      tempPlusSymbol.raise();

      // Draw another line from plus symbol to softmax symbol
      logitLayer.append('line')
        .attr('class', `logit-output-edge-${selectedI}`)
        .attr('x1', intermediateX2 - moveX + plusSymbolRadius$1 * 2)
        .attr('x2', softmaxX)
        .attr('y1', nodeCoordinate$2[curLayerIndex - 1][selectedI].y + nodeLength$5 / 2)
        .attr('y2', nodeCoordinate$2[curLayerIndex - 1][selectedI].y + nodeLength$5 / 2)
        .style('fill', 'none')
        .style('stroke', '#EAEAEA')
        .style('stroke-width', '1.2')
        .lower();

      // Add the flatten to logit links
      let linkData = [];
      let flattenLength = cnn$2.flatten.length / cnn$2[1].length;
      let underneathIs = [...Array(cnn$2[layerIndexDict['output']].length).keys()]
        .filter(d => d != selectedI);
      let curIIndex = 0;
      let linkGen = d3.linkHorizontal()
        .x(d => d.x)
        .y(d => d.y);

      const drawOneEdgeGroup = () => {
        // Only draw the new group if it is in the softmax mode
        if (!allowsSoftmaxAnimation) {
          svg$4.select('.underneath')
            .selectAll(`.logit-lower`)
            .remove();
          return;
        }

        let curI = underneathIs[curIIndex];

        let curEdgeGroup = svg$4.select('.underneath')
          .select(`#logit-lower-${curI}`);
        
        if (curEdgeGroup.empty()) {
          curEdgeGroup = svg$4.select('.underneath')
            .append('g')
            .attr('class', 'logit-lower')
            .attr('id', `logit-lower-${curI}`)
            .style('opacity', 0);


          // Hack: now show all edges, only draw 1/3 of the actual edges
          for (let f = 0; f < flattenLength; f += 3) {
            let loopFactors = [0, nodeCoordinate$2[curLayerIndex - 1].length - 1];
            loopFactors.forEach(l => {
              let factoredF = f + l * flattenLength;
        
              // Flatten -> output
              linkData.push({
                source: {x: intermediateX1 + pixelWidth + 3 - moveX,
                  y:  l === 0 ? topY + f * pixelHeight : bottomY + f * pixelHeight},
                target: {x: intermediateX2 - moveX,
                  y: nodeCoordinate$2[curLayerIndex][curI].y + nodeLength$5 / 2},
                index: factoredF,
                weight: cnn$2.flatten[factoredF].outputLinks[curI].weight,
                color: '#F1F1F1',
                width: 0.5,
                opacity: 1,
                class: `softmax-edge-${curI}`
              });
            });
          }

          // Draw middle rect to logits
          for (let vi = 0; vi < cnn$2[layerIndexDict['output']].length - 2; vi++) {
            linkData.push({
              source: {x: intermediateX1 + pixelWidth + 3 - moveX,
                y: topY + flattenLength * pixelHeight + middleGap * (vi + 1) +
                middleRectHeight * (vi + 0.5)},
              target: {x: intermediateX2 - moveX,
                y: nodeCoordinate$2[curLayerIndex][curI].y + nodeLength$5 / 2},
              index: -1,
              color: '#EDEDED',
              width: 0.5,
              opacity: 1,
              class: `softmax-abstract-edge-${curI}`
            });
          }

          // Render the edges on the underneath layer
          curEdgeGroup.selectAll(`path.softmax-edge-${curI}`)
            .data(linkData)
            .enter()
            .append('path')
            .attr('class', d => d.class)
            .attr('id', d => `edge-${d.name}`)
            .attr('d', d => linkGen({source: d.source, target: d.target}))
            .style('fill', 'none')
            .style('stroke-width', d => d.width)
            .style('stroke', d => d.color === undefined ? intermediateColor$2 : d.color)
            .style('opacity', d => d.opacity)
            .style('pointer-events', 'none');
        }
        
        let curNodeGroup = logitLayer.append('g')
          .attr('class', `logit-layer-${curI}`)
          .style('opacity', 0);
        
        // Draw the plus symbol
        let symbolClone = symbolGroup.clone(true)
          .style('opacity', 0);

        // Change the style of the clone
        symbolClone.attr('class', 'plus-symbol-clone')
          .attr('id', `plus-symbol-clone-${curI}`)
          .select('circle')
          .datum({fill: gappedColorScale(layerColorScales$5.weight,
            flattenRange, cnn$2[layerIndexDict['output']][curI].bias, 0.35)})
          .style('pointer-events', 'none')
          .style('fill', '#E5E5E5');

        symbolClone.attr('transform', `translate(${symbolX},
      ${nodeCoordinate$2[curLayerIndex][curI].y + nodeLength$5 / 2})`);
        
        // Draw the outter link using only merged path
        let outputEdgeD1 = linkGen({
          source: {
            x: intermediateX2 - moveX + plusSymbolRadius$1 * 2,
            y: nodeCoordinate$2[curLayerIndex][curI].y + nodeLength$5 / 2
          },
          target: {
            x: centerX + logitRadius,
            y: nodeCoordinate$2[curLayerIndex][curI].y + nodeLength$5 / 2
          }
        });

        let outputEdgeD2 = linkGen({
          source: {
            x: centerX + logitRadius,
            y: nodeCoordinate$2[curLayerIndex][curI].y + nodeLength$5 / 2
          },
          target: {
            x: softmaxX,
            y: nodeCoordinate$2[curLayerIndex][selectedI].y + nodeLength$5 / 2
          }
        });

        // There are ways to combine these two paths into one. However, the animation
        // for merged path is not continuous, so we use two saperate paths here.

        let outputEdge1 = logitLayerLower.append('path')
          .attr('class', `logit-output-edge-${curI}`)
          .attr('d', outputEdgeD1)
          .style('fill', 'none')
          .style('stroke', '#EAEAEA')
          .style('stroke-width', '1.2');

        let outputEdge2 = logitLayerLower.append('path')
          .attr('class', `logit-output-edge-${curI}`)
          .attr('d', outputEdgeD2)
          .style('fill', 'none')
          .style('stroke', '#EAEAEA')
          .style('stroke-width', '1.2');
        
        let outputEdgeLength1 = outputEdge1.node().getTotalLength();
        let outputEdgeLength2 = outputEdge2.node().getTotalLength();
        let totalLength = outputEdgeLength1 + outputEdgeLength2;
        let totalDuration = hasInitialized ? 500 : 800;
        let opacityDuration = hasInitialized ? 400 : 600;

        outputEdge1.attr('stroke-dasharray', outputEdgeLength1 + ' ' + outputEdgeLength1)
          .attr('stroke-dashoffset', outputEdgeLength1);
        
        outputEdge2.attr('stroke-dasharray', outputEdgeLength2 + ' ' + outputEdgeLength2)
          .attr('stroke-dashoffset', outputEdgeLength2);

        outputEdge1.transition('softmax-output-edge')
          .duration(outputEdgeLength1 / totalLength * totalDuration)
          .attr('stroke-dashoffset', 0);

        outputEdge2.transition('softmax-output-edge')
          .delay(outputEdgeLength1 / totalLength * totalDuration)
          .duration(outputEdgeLength2 / totalLength * totalDuration)
          .attr('stroke-dashoffset', 0);
        
        // Draw the logit circle
        curNodeGroup.append('circle')
          .attr('class', 'logit-circle')
          .attr('id', `logit-circle-${curI}`)
          .attr('cx', centerX)
          .attr('cy', nodeCoordinate$2[curLayerIndex - 1][curI].y + nodeLength$5 / 2)
          .attr('r', 7)
          .style('fill', layerColorScales$5.logit(logitColorScale(logits[curI])))
          .style('stroke', intermediateColor$2)
          .style('cursor', 'crosshair')
          .on('mouseover', () => logitCircleMouseOverHandler(curI))
          .on('mouseleave', () => logitCircleMouseLeaveHandler(curI))
          .on('click', () => { d3.event.stopPropagation(); });
        
        // Show the element in the detailed view
        softmaxDetailViewInfo.startAnimation = {
          i: curI,
          duration: opacityDuration,
          // Always show the animation
          hasInitialized: false
        };
        softmaxDetailViewStore.set(softmaxDetailViewInfo);

        // Show the elements with animation    
        curNodeGroup.transition('softmax-edge')
          .duration(opacityDuration)
          .style('opacity', 1);

        if ((selectedI < 3 && curI == 9) || (selectedI >= 3 && curI == 0)) {
          // Show the hover text
          softmaxDetailAnnotation.select('.softmax-detail-hover-annotation')
            .transition('softmax-edge')
            .duration(opacityDuration)
            .style('opacity', 1);
        }

        softmaxDetailAnnotation.select(`#logit-text-${curI}`)
          .transition('softmax-edge')
          .duration(opacityDuration)
          .style('opacity', 1);
        
        curEdgeGroup.transition('softmax-edge')
          .duration(opacityDuration)
          .style('opacity', 1)
          .on('end', () => {
            // Recursive animaiton
            curIIndex ++;
            if (curIIndex < underneathIs.length) {
              linkData = [];
              drawOneEdgeGroup();
            } else {
              hasInitialized = true;
              softmaxDetailViewInfo.hasInitialized = true;
              softmaxDetailViewStore.set(softmaxDetailViewInfo);
            }
          });
        
        symbolClone.transition('softmax-edge')
          .duration(opacityDuration)
          .style('opacity', 0.2);
      };

      // Show the softmax detail view
      let anchorElement = svg$4.select('.intermediate-layer')
        .select('.layer-label').node();
      let pos = getMidCoords(svg$4, anchorElement);
      let wholeSvg = d3.select('#cnn-svg');
      let svgYMid = +wholeSvg.style('height').replace('px', '') / 2;
      let detailViewTop = 100 + svgYMid - 192 / 2;

      const detailview = document.getElementById('detailview');
      detailview.style.top = `${detailViewTop}px`;
      detailview.style.left = `${pos.left - 490 - 50}px`;
      detailview.style.position = 'absolute';

      softmaxDetailViewStore.set({
        show: true,
        logits: logits,
        logitColors: logits.map(d => layerColorScales$5.logit(logitColorScale(d))),
        selectedI: selectedI,
        highlightI: -1,
        outputName: classList[selectedI],
        outputValue: cnn$2[layerIndexDict['output']][selectedI].output,
        startAnimation: {i: -1, duration: 0, hasInitialized: hasInitialized}
      });

      drawOneEdgeGroup();

      // Draw logit circle color scale
      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: d3.extent(logits)[1] - d3.extent(logits)[0],
        minMax: {min: d3.extent(logits)[0], max: d3.extent(logits)[1]},
        group: logitLayer,
        width: softmaxX - (intermediateX2 + plusSymbolRadius$1 * 2 - moveX + 5),
        gradientAppendingName: 'flatten-logit-gradient',
        gradientGap: 0.1,
        colorScale: layerColorScales$5.logit,
        x: intermediateX2 + plusSymbolRadius$1 * 2 - moveX + 5,
        y: svgPaddings$3.top + vSpaceAroundGap$3 * (10) + vSpaceAroundGap$3 + 
          nodeLength$5 * 10
      });

      // Draw logit layer label
      let logitLabel = logitLayer.append('g')
        .attr('class', 'layer-label')
        .classed('hidden', detailedMode$2)
        .attr('transform', () => {
          let x = centerX;
          let y = (svgPaddings$3.top + vSpaceAroundGap$3) / 2 + 5;
          return `translate(${x}, ${y})`;
        });

      logitLabel.append('text')
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .style('opacity', 0.8)
        .style('font-weight', 800)
        .text('logit');
    };

    const removeLogitLayer = () => {
      svg$4.select('.logit-layer').remove();
      svg$4.select('.logit-layer-lower').remove();
      svg$4.selectAll('.plus-symbol-clone').remove();

      // Instead of removing the paths, we hide them, so it is faster to load in
      // the future
      svg$4.select('.underneath')
        .selectAll('.logit-lower')
        .style('opacity', 0);

      softmaxDetailViewStore.set({
          show: false,
          logits: []
      });
    };

    const softmaxClicked = (arg) => {
      let curLayerIndex = arg.curLayerIndex,
        moveX = arg.moveX,
        symbolX = arg.symbolX,
        symbolY = arg.symbolY,
        outputX = arg.outputX,
        outputY = arg.outputY,
        softmaxLeftMid = arg.softmaxLeftMid,
        selectedI = arg.selectedI,
        intermediateX1 = arg.intermediateX1,
        intermediateX2 = arg.intermediateX2,
        pixelWidth = arg.pixelWidth,
        pixelHeight = arg.pixelHeight,
        topY = arg.topY,
        bottomY = arg.bottomY,
        middleGap = arg.middleGap,
        middleRectHeight = arg.middleRectHeight,
        softmaxX = arg.softmaxX,
        softmaxTextY = arg.softmaxTextY,
        softmaxWidth = arg.softmaxWidth,
        symbolGroup = arg.symbolGroup,
        flattenRange = arg.flattenRange;

      let duration = 600;
      let centerX = softmaxLeftMid - moveX * 4 / 5;
      d3.event.stopPropagation();

      // Clean up the logit elemends before moving anything
      if (isInSoftmax) {
        allowsSoftmaxAnimationStore.set(false);
        removeLogitLayer();
      } else {
        allowsSoftmaxAnimationStore.set(true);
      }

      // Move the overlay gradient
      svg$4.select('.intermediate-layer-overlay')
        .select('rect.overlay')
        .transition('softmax')
        .ease(d3.easeCubicInOut)
        .duration(duration)
        .attr('transform', `translate(${isInSoftmax ? 0 : -moveX}, ${0})`);

      // Move the legends
      svg$4.selectAll(`.intermediate-legend-${curLayerIndex - 1}`)
        .each((d, i, g) => moveLegend(d, i, g, moveX, duration, isInSoftmax));

      svg$4.select('.intermediate-layer')
        .select(`.layer-label`)
        .each((d, i, g) => moveLegend(d, i, g, moveX, duration, isInSoftmax));

      svg$4.select('.intermediate-layer')
        .select(`.layer-detailed-label`)
        .each((d, i, g) => moveLegend(d, i, g, moveX, duration, isInSoftmax));

      // Also move all layers on the left
      for (let i = curLayerIndex - 1; i >= 0; i--) {
        let curLayer = svg$4.select(`g#cnn-layer-group-${i}`);
        let previousX = +curLayer.select('image').attr('x');
        let newX = isInSoftmax ? previousX + moveX : previousX - moveX;
        moveLayerX({
          layerIndex: i,
          targetX: newX,
          disable: true,
          delay: 0,
          transitionName: 'softmax',
          duration: duration
        });
      }

      // Hide the sum up annotation
      svg$4.select('.plus-annotation')
        .transition('softmax')
        .duration(duration)
        .style('opacity', isInSoftmax ? 1 : 0)
        .style('pointer-events', isInSoftmax ? 'all' : 'none');

      // Hide the softmax annotation
      let softmaxAnnotation = svg$4.select('.softmax-annotation')
        .style('pointer-events', isInSoftmax ? 'all' : 'none');
      
      let softmaxDetailAnnotation = softmaxAnnotation.selectAll('.softmax-detail-annoataion')
        .data([0])
        .enter()
        .append('g')
        .attr('class', 'softmax-detail-annoataion');

      // Remove the detailed annoatioan when quitting the detail view
      if (isInSoftmax) {
        softmaxAnnotation.selectAll('.softmax-detail-annoataion').remove();
      }

      softmaxAnnotation.select('.arrow-group')
        .transition('softmax')
        .duration(duration)
        .style('opacity', isInSoftmax ? 1 : 0);

      softmaxAnnotation.select('.annotation-text')
        .style('cursor', 'help')
        .style('pointer-events', 'all')
        .on('click', () => {
          d3.event.stopPropagation();
          // Scroll to the article element
          document.querySelector(`#article-softmax`).scrollIntoView({ 
            behavior: 'smooth' 
          });
        })
        .transition('softmax')
        .duration(duration)
        .style('opacity', isInSoftmax ? 1 : 0)
        .on('end', () => {
          if (!isInSoftmax) {
            // Add new annotation for the softmax button
            let textX = softmaxX + softmaxWidth / 2;
            let textY = softmaxTextY - 10;

            if (selectedI === 0) {
              textY = softmaxTextY + 70;
            }

            let text = softmaxDetailAnnotation.append('text')
              .attr('x', textX)
              .attr('y', textY)
              .attr('class', 'annotation-text softmax-detail-text')
              .style('dominant-baseline', 'baseline')
              .style('text-anchor', 'middle')
              .text('Normalize ');
            
            text.append('tspan') 
              .attr('dx', 1)
              .style('fill', '#E56014')
              .text('logits');
            
            text.append('tspan')
              .attr('dx', 1)
              .text(' into');

            text.append('tspan')
              .attr('x', textX)
              .attr('dy', '1.1em')
              .text('class probabilities');

            if (selectedI === 0) {
              drawArrow({
                group: softmaxDetailAnnotation,
                sx: softmaxX + softmaxWidth / 2 - 5,
                sy: softmaxTextY + 44,
                tx: softmaxX + softmaxWidth / 2,
                ty: textY - 12,
                dr: 50,
                hFlip: true,
                marker: 'marker-alt'
              });
            } else {
              drawArrow({
                group: softmaxDetailAnnotation,
                sx: softmaxX + softmaxWidth / 2 - 5,
                sy: softmaxTextY + 4,
                tx: softmaxX + softmaxWidth / 2,
                ty: symbolY - plusSymbolRadius$1 - 4,
                dr: 50,
                hFlip: true,
                marker: 'marker-alt'
              });
            }

            // Add annotation for the logit layer label
            textX = centerX + 45;
            textY = (svgPaddings$3.top + vSpaceAroundGap$3) / 2 + 5;
            let arrowTX = centerX + 20;
            let arrowTY = (svgPaddings$3.top + vSpaceAroundGap$3) / 2 + 5;

            softmaxDetailAnnotation.append('g')
              .attr('class', 'layer-detailed-label')
              .attr('transform', () => {
                let x = centerX;
                let y = (svgPaddings$3.top + vSpaceAroundGap$3) / 2 - 5;
                return `translate(${x}, ${y})`;
              })
              .classed('hidden', !detailedMode$2)
              .append('text')
              // .attr('x', centerX)
              // .attr('y',  (svgPaddings.top + vSpaceAroundGap) / 2 - 6)
              .style('opacity', 0.7)
              .style('dominant-baseline', 'middle')
              .style('font-size', '12px')
              .style('font-weight', '800')
              .append('tspan')
              .attr('x', 0)
              .text('logit')
              .append('tspan')
              .attr('x', 0)
              .style('font-size', '8px')
              .style('font-weight', 'normal')
              .attr('dy', '1.5em')
              .text('(10)');

            softmaxDetailAnnotation.append('text')
              .attr('class', 'annotation-text')
              .attr('x', textX)
              .attr('y', (svgPaddings$3.top + vSpaceAroundGap$3) / 2 + 3)
              .style('text-anchor', 'start')
              .text('Before')
              .append('tspan')
              .attr('x', textX)
              .attr('dy', '1em')
              .text('normalization');


            drawArrow({
              group: softmaxDetailAnnotation,
              tx: arrowTX,
              ty: arrowTY,
              sx: textX - 6,
              sy: textY + 2,
              dr: 60,
              hFlip: false,
              marker: 'marker-alt'
            });

            softmaxDetailAnnotation.append('text')
              .attr('class', 'annotation-text')
              .attr('x', nodeCoordinate$2[layerIndexDict['output']][0].x - 35)
              .attr('y', (svgPaddings$3.top + vSpaceAroundGap$3) / 2 + 3)
              .style('text-anchor', 'end')
              .text('After')
              .append('tspan')
              .attr('x', nodeCoordinate$2[layerIndexDict['output']][0].x - 35)
              .attr('dy', '1em')
              .text('normalization');

            drawArrow({
              group: softmaxDetailAnnotation,
              tx: nodeCoordinate$2[layerIndexDict['output']][0].x - 8,
              ty: arrowTY,
              sx: nodeCoordinate$2[layerIndexDict['output']][0].x - 27,
              sy: textY + 2,
              dr: 60,
              hFlip: true,
              marker: 'marker-alt'
            });

            console.log(nodeCoordinate$2[curLayerIndex - 1].length);
            // Add annotation for the logit circle
            for (let i = 0; i < nodeCoordinate$2[curLayerIndex - 1].length; i++) {
              softmaxDetailAnnotation.append('text')
                .attr('x', centerX)
                .attr('y', nodeCoordinate$2[curLayerIndex - 1][i].y + nodeLength$5 / 2 + 8)
                .attr('class', 'annotation-text softmax-detail-text')
                .attr('id', `logit-text-${i}`)
                .style('text-anchor', 'middle')
                .style('dominant-baseline', 'hanging')
                .style('opacity', 0)
                .text(`${classList[i]}`);
            }

            let hoverTextGroup = softmaxDetailAnnotation.append('g')
              .attr('class', 'softmax-detail-hover-annotation')
              .style('opacity', 0);

            textX = centerX + 50;
            textY = nodeCoordinate$2[curLayerIndex - 1][0].y + nodeLength$5 / 2;

            if (selectedI < 3) {
              textY = nodeCoordinate$2[curLayerIndex - 1][nodeCoordinate$2[curLayerIndex - 1].length - 1].y + nodeLength$5 / 2;
            }

            // Add annotation to prompt user to check the logit value
            let hoverText = hoverTextGroup.append('text')
              .attr('x', textX)
              .attr('y', textY)
              .attr('class', 'annotation-text softmax-detail-text softmax-hover-text')
              .style('text-anchor', 'start')
              .style('dominant-baseline', 'baseline')
              .append('tspan')
              .style('font-weight', 700)
              .style('dominant-baseline', 'baseline')
              .text(`Hover over `)
              .append('tspan')
              .style('font-weight', 400)
              .style('dominant-baseline', 'baseline')
              .text('to see');
            
            hoverText.append('tspan')
              .style('dominant-baseline', 'baseline')
              .attr('x', textX)
              .attr('dy', '1em')
              .text('its ');

            hoverText.append('tspan')
              .style('dominant-baseline', 'baseline')
              .attr('dx', 1)
              .style('fill', '#E56014')
              .text('logit');
            
            hoverText.append('tspan')
              .style('dominant-baseline', 'baseline')
              .attr('dx', 1)
              .text(' value');
            
            drawArrow({
              group: hoverTextGroup,
              tx: centerX + 15,
              ty: textY,
              sx: textX - 8,
              sy: textY + 2,
              dr: 60,
              hFlip: false
            });
          }
        });

      // Hide the annotation
      svg$4.select('.flatten-annotation')
        .transition('softmax')
        .duration(duration)
        .style('opacity', isInSoftmax ? 1 : 0)
        .style('pointer-events', isInSoftmax ? 'all' : 'none');

      // Move the left part of faltten layer elements
      let flattenLeftPart = svg$4.select('.flatten-layer-left');
      flattenLeftPart.transition('softmax')
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .attr('transform', `translate(${isInSoftmax ? 0 : -moveX}, ${0})`)
        .on('end', () => {
          // Add the logit layer
          if (!isInSoftmax) {
            let logitArg = {
              curLayerIndex: curLayerIndex,
              moveX: moveX,
              softmaxLeftMid: softmaxLeftMid,
              selectedI: selectedI,
              intermediateX1: intermediateX1,
              intermediateX2: intermediateX2,
              pixelWidth: pixelWidth,
              pixelHeight: pixelHeight,
              topY: topY,
              bottomY: bottomY,
              middleGap: middleGap,
              middleRectHeight: middleRectHeight,
              softmaxX: softmaxX,
              symbolGroup: symbolGroup,
              symbolX: symbolX,
              flattenRange: flattenRange
            };
            drawLogitLayer(logitArg);
          }

          // Redraw the line from the plus symbol to the output node
          if (!isInSoftmax) {
            let newLine = flattenLeftPart.select('.edge-group')
              .append('line')
              .attr('class', 'symbol-output-line')
              .attr('x1', symbolX)
              .attr('y1', symbolY)
              .attr('x2', outputX + moveX)
              .attr('y2', outputY)
              .style('stroke-width', 1.2)
              .style('stroke', '#E5E5E5')
              .style('opacity', 0);
            
            newLine.transition('softmax')
              .delay(duration / 3)
              .duration(duration * 2 / 3)
              .style('opacity', 1);
          } else {
            flattenLeftPart.select('.symbol-output-line').remove();
          }
          
          isInSoftmax = !isInSoftmax;
          isInSoftmaxStore.set(isInSoftmax);
        });
    };

    /**
     * Draw the flatten layer before output layer
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     */
     
    const drawFlatten = (curLayerIndex, d, i, width, height) => {
      // Show the output legend
      svg$4.selectAll('.output-legend')
        .classed('hidden', false);

      let maxLayer = nodeCoordinate$2[curLayerIndex - 1].length - 1;
      let pixelWidth = nodeLength$5 / 2;
      let pixelHeight = 1.1;
      let totalLength = (2 * nodeLength$5 +
        5.5 * hSpaceAroundGap$2 * gapRatio$2 + pixelWidth);
      let leftX = nodeCoordinate$2[curLayerIndex][0].x - totalLength;
      let intermediateGap = (hSpaceAroundGap$2 * gapRatio$2 * 4) / 2;
      const minimumGap = 20;
      let linkGen = d3.linkHorizontal()
        .x(d => d.x)
        .y(d => d.y);

      // Hide the edges
      svg$4.select('g.edge-group')
        .style('visibility', 'hidden');

      // Move the previous layer
      moveLayerX({layerIndex: curLayerIndex - 1, targetX: leftX,
        disable: true, delay: 0});

      // Disable the current layer (output layer)
      moveLayerX({layerIndex: curLayerIndex,
        targetX: nodeCoordinate$2[curLayerIndex][0].x, disable: true,
        delay: 0, opacity: 0.15, specialIndex: i});
      
      // Compute the gap in the left shrink region
      let leftEnd = leftX - hSpaceAroundGap$2;
      let leftGap = (leftEnd - nodeCoordinate$2[0][0].x - 10 * nodeLength$5) / 10;

      // Different from other intermediate view, we push the left part dynamically
      // 1. If there is enough space, we fix the first layer position and move all
      // other layers;
      // 2. If there is not enough space, we maintain the minimum gap and push all
      // left layers to the left (could be out-of-screen)
      if (leftGap > minimumGap) {
        // Move the left layers
        for (let i = 0; i < curLayerIndex - 1; i++) {
          let curX = nodeCoordinate$2[0][0].x + i * (nodeLength$5 + leftGap);
          moveLayerX({layerIndex: i, targetX: curX, disable: true, delay: 0});
        }
      } else {
        leftGap = minimumGap;
        let curLeftBound = leftX - leftGap * 2 - nodeLength$5;
        // Move the left layers
        for (let i = curLayerIndex - 2; i >= 0; i--) {
          moveLayerX({layerIndex: i, targetX: curLeftBound, disable: true, delay: 0});
          curLeftBound = curLeftBound - leftGap - nodeLength$5;
        }
      }

      // Add an overlay
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 1},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.85}];
      addOverlayGradient('overlay-gradient-left', stops);

      let intermediateLayerOverlay = svg$4.append('g')
        .attr('class', 'intermediate-layer-overlay');

      intermediateLayerOverlay.append('rect')
        .attr('class', 'overlay')
        .style('fill', 'url(#overlay-gradient-left)')
        .style('stroke', 'none')
        .attr('width', leftX + svgPaddings$3.left - (leftGap * 2) + 3)
        .attr('height', height + svgPaddings$3.top + svgPaddings$3.bottom)
        .attr('x', -svgPaddings$3.left)
        .attr('y', 0)
        .style('opacity', 0);
      
      intermediateLayerOverlay.selectAll('rect.overlay')
        .transition('move')
        .duration(800)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);

      // Add the intermediate layer
      let intermediateLayer = svg$4.append('g')
        .attr('class', 'intermediate-layer')
        .style('opacity', 0);
      
      let intermediateX1 = leftX + nodeLength$5 + intermediateGap;
      let intermediateX2 = intermediateX1 + intermediateGap + pixelWidth;
      let range = cnnLayerRanges$2[selectedScaleLevel$2][curLayerIndex - 1];
      let colorScale = layerColorScales$5.conv;
      let flattenLength = cnn$2.flatten.length / cnn$2[1].length;
      let linkData = [];

      let flattenLayer = intermediateLayer.append('g')
        .attr('class', 'flatten-layer');
      
      let flattenLayerLeftPart = flattenLayer.append('g')
        .attr('class', 'flatten-layer-left');

      let topY = nodeCoordinate$2[curLayerIndex - 1][0].y;
      let bottomY = nodeCoordinate$2[curLayerIndex - 1][maxLayer].y + nodeLength$5 -
            flattenLength * pixelHeight;
      
      // Compute the pre-layer gap
      let preLayerDimension = cnn$2[curLayerIndex - 1][0].output.length;
      let preLayerGap = nodeLength$5 / (2 * preLayerDimension);

      // Compute bounding box length
      let boundingBoxLength = nodeLength$5 / preLayerDimension;

      // Compute the weight color scale
      let flattenExtent = d3.extent(cnn$2.flatten.slice(flattenLength)
        .map(d => d.outputLinks[i].weight)
        .concat(cnn$2.flatten.slice(9 * flattenLength, 10 * flattenLength)
          .map(d => d.outputLinks[i].weight)));

      let flattenRange = 2 * (Math.round(
        Math.max(...flattenExtent.map(Math.abs)) * 1000) / 1000);

      let flattenMouseOverHandler = (d) => {
        let index = d.index;
        // Screenshot
        // console.log(index);

        // Update the hover info UI
        if (d.weight === undefined) {
          hoverInfo = {
            show: true,
            text: `Pixel value: ${formater$2(flattenFactoredFDict[index])}`
          };
        } else {
          hoverInfo = {
            show: true,
            text: `Weight: ${formater$2(d.weight)}`
          };
        }
        hoverInfoStore.set(hoverInfo);

        flattenLayerLeftPart.select(`#edge-flatten-${index}`)
          .raise()
          .style('stroke', intermediateColor$2)
          .style('stroke-width', 1);

        flattenLayerLeftPart.select(`#edge-flatten-${index}-output`)
          .raise()
          .style('stroke-width', 1)
          .style('stroke', da => gappedColorScale(layerColorScales$5.weight,
            flattenRange, da.weight, 0.1));

        flattenLayerLeftPart.select(`#bounding-${index}`)
          .raise()
          .style('opacity', 1);
      };

      let flattenMouseLeaveHandler = (d) => {
        let index = d.index;

        // screenshot
        // if (index === 32) {return;}

        // Update the hover info UI
        if (d.weight === undefined) {
          hoverInfo = {
            show: false,
            text: `Pixel value: ${formater$2(flattenFactoredFDict[index])}`
          };
        } else {
          hoverInfo = {
            show: false,
            text: `Weight: ${formater$2(d.weight)}`
          };
        }
        hoverInfoStore.set(hoverInfo);

        flattenLayerLeftPart.select(`#edge-flatten-${index}`)
          .style('stroke-width', 0.6)
          .style('stroke', '#E5E5E5');

        flattenLayerLeftPart.select(`#edge-flatten-${index}-output`)
          .style('stroke-width', 0.6)
          .style('stroke', da => gappedColorScale(layerColorScales$5.weight,
            flattenRange, da.weight, 0.35));

        flattenLayerLeftPart.select(`#bounding-${index}`)
          .raise()
          .style('opacity', 0);
      };
    console.log(flattenLength);
      flattenFactoredFDict = {};
      for (let f = 0; f < flattenLength; f++) {
        let loopFactors = [0, maxLayer];
        loopFactors.forEach(l => {
          let factoredF = f + l * flattenLength;
          flattenFactoredFDict[factoredF] = cnn$2.flatten[factoredF].output;
          flattenLayerLeftPart.append('rect')
            .attr('x', intermediateX1)
            .attr('y', l === 0 ? topY + f * pixelHeight : bottomY + f * pixelHeight)
            .attr('width', pixelWidth)
            .attr('height', pixelHeight)
            .style('cursor', 'crosshair')
            .style('fill', colorScale((cnn$2.flatten[factoredF].output + range / 2) / range))
            .on('mouseover', () => flattenMouseOverHandler({index: factoredF}))
            .on('mouseleave', () => flattenMouseLeaveHandler({index: factoredF}))
            .on('click', () => { d3.event.stopPropagation(); });

          // Flatten -> output
          linkData.push({
            source: {x: intermediateX1 + pixelWidth + 3,
              y:  l === 0 ? topY + f * pixelHeight : bottomY + f * pixelHeight},
            target: {x: intermediateX2,
              //nodeCoordinate[curLayerIndex][i].x - nodeLength,
              y: nodeCoordinate$2[curLayerIndex][i].y + nodeLength$5 / 2},
            index: factoredF,
            weight: cnn$2.flatten[factoredF].outputLinks[i].weight,
            name: `flatten-${factoredF}-output`,
            color: gappedColorScale(layerColorScales$5.weight,
              flattenRange, cnn$2.flatten[factoredF].outputLinks[i].weight, 0.35),
            width: 0.6,
            opacity: 1,
            class: `flatten-output`
          });

          // Pre-layer -> flatten
          let row = Math.floor(f / preLayerDimension);
          linkData.push({
            target: {x: intermediateX1 - 3,
              y:  l === 0 ? topY + f * pixelHeight : bottomY + f * pixelHeight},
            source: {x: leftX + nodeLength$5 + 3,
              y: nodeCoordinate$2[curLayerIndex - 1][l].y + (2 * row + 1) * preLayerGap},
            index: factoredF,
            name: `flatten-${factoredF}`,
            color: '#E5E5E5',
            // color: gappedColorScale(layerColorScales.conv,
            //   2 * Math.max(Math.abs(cnnLayerMinMax[10].max), Math.abs(cnnLayerMinMax[10].min)),
            //   cnn.flatten[factoredF].output, 0.2),
            width: 0.6,
            opacity: 1,
            class: `flatten`
          });

          // Add original pixel bounding box
          let loc = cnn$2.flatten[factoredF].inputLinks[0].weight;
          flattenLayerLeftPart.append('rect')
            .attr('id', `bounding-${factoredF}`)
            .attr('class', 'flatten-bounding')
            .attr('x', leftX + loc[1] * boundingBoxLength)
            .attr('y', nodeCoordinate$2[curLayerIndex - 1][l].y + loc[0] * boundingBoxLength)
            .attr('width', boundingBoxLength)
            .attr('height', boundingBoxLength)
            .style('fill', 'none')
            .style('stroke', intermediateColor$2)
            .style('stroke-length', '0.5')
            .style('pointer-events', 'all')
            .style('cursor', 'crosshair')
            .style('opacity', 0)
            .on('mouseover', () => flattenMouseOverHandler({index: factoredF}))
            .on('mouseleave', () => flattenMouseLeaveHandler({index: factoredF}))
            .on('click', () => {d3.event.stopPropagation();});
        }); 
      }
      
      // Use abstract symbol to represent the flatten nodes in between (between
      // the first and the last nodes)
      // Compute the average value of input node and weights
      let meanValues = [];
      for (let n = 1; n < cnn$2[curLayerIndex - 1].length - 1; n++) {
        /*
        let meanOutput = d3.mean(cnn.flatten.slice(flattenLength * n,
          flattenLength * (n + 1)).map(d => d.output));
        let meanWeight= d3.mean(cnn.flatten.slice(flattenLength * n,
          flattenLength * (n + 1)).map(d => d.outputLinks[i].weight));
        meanValues.push({index: n, output: meanOutput, weight: meanWeight});
        */
        meanValues.push({index: n});
      }

      // Compute the middle gap
      let middleGap = 5;
      let middleRectHeight = (10 * nodeLength$5 + (10 - 1) * vSpaceAroundGap$3 -
        pixelHeight * flattenLength * 2 - 5 * (8 + 1)) / 8;

      // Add middle nodes
      meanValues.forEach((v, vi) => {
        // Add a small rectangle
        flattenLayerLeftPart.append('rect')
          .attr('x', intermediateX1 + pixelWidth / 4)
          .attr('y', topY + flattenLength * pixelHeight + middleGap * (vi + 1) +
            middleRectHeight * vi)
          .attr('width', pixelWidth / 2)
          .attr('height', middleRectHeight)
          // .style('fill', colorScale((v.output + range / 2) / range));
          .style('fill', '#E5E5E5');
        
        // Add a triangle next to the input node
        flattenLayerLeftPart.append('polyline')
          .attr('points',
            `${leftX + nodeLength$5 + 3}
        ${nodeCoordinate$2[curLayerIndex - 1][v.index].y},
        ${leftX + nodeLength$5 + 10}
        ${nodeCoordinate$2[curLayerIndex - 1][v.index].y + nodeLength$5 / 2},
        ${leftX + nodeLength$5 + 3}
        ${nodeCoordinate$2[curLayerIndex - 1][v.index].y + nodeLength$5}`)
          .style('fill', '#E5E5E5')
          .style('opacity', 1);
        
        // Input -> flatten
        linkData.push({
          source: {x: leftX + nodeLength$5 + 10,
            y: nodeCoordinate$2[curLayerIndex - 1][v.index].y + nodeLength$5 / 2},
          target: {x: intermediateX1 - 3,
            y: topY + flattenLength * pixelHeight + middleGap * (vi + 1) +
              middleRectHeight * (vi + 0.5)},
          index: -1,
          width: 1,
          opacity: 1,
          name: `flatten-abstract-${v.index}`,
          color: '#E5E5E5',
          class: `flatten-abstract`
        });

        // Flatten -> output
        linkData.push({
          source: {x: intermediateX1 + pixelWidth + 3,
          y: topY + flattenLength * pixelHeight + middleGap * (vi + 1) +
            middleRectHeight * (vi + 0.5)},
          target: {x: intermediateX2,
          y: nodeCoordinate$2[curLayerIndex][i].y + nodeLength$5 / 2},
          index: -1,
          name: `flatten-abstract-${v.index}-output`,
          // color: gappedColorScale(layerColorScales.weight, flattenRange,
          //   v.weight, 0.35),
          color: '#E5E5E5',
          weight: v.weight,
          width: 1,
          opacity: 1,
          class: `flatten-abstract-output`
        });
      });

      // Draw the plus operation symbol
      let symbolX = intermediateX2 + plusSymbolRadius$1;
      let symbolY = nodeCoordinate$2[curLayerIndex][i].y + nodeLength$5 / 2;
      let symbolRectHeight = 1;
      let symbolGroup = flattenLayerLeftPart.append('g')
        .attr('class', 'plus-symbol')
        .attr('transform', `translate(${symbolX}, ${symbolY})`);
      
      symbolGroup.append('rect')
        .attr('x', -plusSymbolRadius$1)
        .attr('y', -plusSymbolRadius$1)
        .attr('width', plusSymbolRadius$1 * 2)
        .attr('height', plusSymbolRadius$1 * 2)
        .attr('rx', 3)
        .attr('ry', 3)
        .style('fill', 'none')
        .style('stroke', intermediateColor$2);
      
      symbolGroup.append('rect')
        .attr('x', -(plusSymbolRadius$1 - 3))
        .attr('y', -symbolRectHeight / 2)
        .attr('width', 2 * (plusSymbolRadius$1 - 3))
        .attr('height', symbolRectHeight)
        .style('fill', intermediateColor$2);

      symbolGroup.append('rect')
        .attr('x', -symbolRectHeight / 2)
        .attr('y', -(plusSymbolRadius$1 - 3))
        .attr('width', symbolRectHeight)
        .attr('height', 2 * (plusSymbolRadius$1 - 3))
        .style('fill', intermediateColor$2);

      // Place the bias rectangle below the plus sign if user clicks the first
      // conv node (no need now, since we added annotaiton for softmax to make it
      // look better aligned)
      // Add bias symbol to the plus symbol
      symbolGroup.append('circle')
        .attr('cx', 0)
        .attr('cy', -nodeLength$5 / 2 - 0.5 * kernelRectLength$1)
        .attr('r', kernelRectLength$1 * 1.5)
        .style('stroke', intermediateColor$2)
        .style('cursor', 'crosshair')
        .style('fill', gappedColorScale(layerColorScales$5.weight,
            flattenRange, d.bias, 0.35))
        .on('mouseover', () => {
          hoverInfoStore.set( {show: true, text: `Bias: ${formater$2(d.bias)}`} );
        })
        .on('mouseleave', () => {
          hoverInfoStore.set( {show: false, text: `Bias: ${formater$2(d.bias)}`} );
        })
        .on('click', () => { d3.event.stopPropagation(); });
      
      // Link from bias to the plus symbol
      symbolGroup.append('path')
        .attr('d', linkGen({
          source: { x: 0, y: 0 },
          target: { x: 0, y: -nodeLength$5 / 2 - 0.5 * kernelRectLength$1 }
        }))
        .attr('id', 'bias-plus')
        .attr('stroke-width', 1.2)
        .attr('stroke', '#E5E5E5')
        .lower();

      // Link from the plus symbol to the output
      linkData.push({
        source: getOutputKnot({x: intermediateX2 + 2 * plusSymbolRadius$1 - nodeLength$5,
          y: nodeCoordinate$2[curLayerIndex][i].y}),
        target: getInputKnot({x: nodeCoordinate$2[curLayerIndex][i].x - 3,
          y: nodeCoordinate$2[curLayerIndex][i].y}),
        name: `symbol-output`,
        width: 1.2,
        color: '#E5E5E5'
      });

      // Draw softmax operation symbol
      let softmaxWidth = 55;
      let emptySpace = ((totalLength - 2 * nodeLength$5 - 2 * intermediateGap)
        - softmaxWidth) / 2;
      let symbolEndX = intermediateX2 + plusSymbolRadius$1 * 2;
      let softmaxX = emptySpace + symbolEndX;
      let softmaxLeftMid = emptySpace / 2 + symbolEndX;
      let softmaxTextY = nodeCoordinate$2[curLayerIndex][i].y - 2 * kernelRectLength$1 - 6;
      let moveX = (intermediateX2 - (intermediateX1 + pixelWidth + 3)) * 2 / 3;

      let softmaxArg = {
        curLayerIndex: curLayerIndex,
        moveX: moveX,
        symbolX: symbolX,
        symbolY: symbolY,
        outputX: nodeCoordinate$2[curLayerIndex][i].x,
        outputY: symbolY,
        softmaxLeftMid: softmaxLeftMid,
        selectedI: i,
        intermediateX1: intermediateX1,
        intermediateX2: intermediateX2,
        pixelWidth: pixelWidth,
        pixelHeight: pixelHeight,
        topY: topY,
        bottomY: bottomY,
        middleGap: middleGap,
        middleRectHeight: middleRectHeight,
        softmaxX: softmaxX,
        softmaxWidth: softmaxWidth,
        softmaxTextY: softmaxTextY,
        symbolGroup: symbolGroup,
        flattenRange: flattenRange
      };

      let softmaxSymbol = intermediateLayer.append('g')
        .attr('class', 'softmax-symbol')
        .attr('transform', `translate(${softmaxX}, ${symbolY})`)
        .style('pointer-event', 'all')
        .style('cursor', 'pointer')
        .on('click', () => softmaxClicked(softmaxArg));
      
      softmaxSymbol.append('rect')
        .attr('x', 0)
        .attr('y', -plusSymbolRadius$1)
        .attr('width', softmaxWidth)
        .attr('height', plusSymbolRadius$1 * 2)
        .attr('stroke', intermediateColor$2)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill', '#FAFAFA');
      
      softmaxSymbol.append('text')
        .attr('x', 5)
        .attr('y', 1)
        .style('dominant-baseline', 'middle')
        .style('font-size', '12px')
        .style('opacity', 0.5)
        .text('softmax');

      // Draw the layer label
      let layerLabel = intermediateLayer.append('g')
        .attr('class', 'layer-label')
        .classed('hidden', detailedMode$2)
        .attr('transform', () => {
          let x = leftX + nodeLength$5 + (4 * hSpaceAroundGap$2 * gapRatio$2 +
            pixelWidth) / 2;
          let y = (svgPaddings$3.top + vSpaceAroundGap$3) / 2 + 5;
          return `translate(${x}, ${y})`;
        })
        .style('cursor', 'help')
        .on('click', () => {
          d3.event.stopPropagation();
          // Scroll to the article element
          document.querySelector(`#article-flatten`).scrollIntoView({ 
            behavior: 'smooth' 
          });
        });
      
      layerLabel.append('text')
        .style('dominant-baseline', 'middle')
        .style('opacity', 0.8)
        .style('font-weight', 800)
        .text('flatten');

      let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
      let scroll = new SmoothScroll('a[href*="#"]', {offset: -svgHeight});
        
      let detailedLabelGroup = intermediateLayer.append('g')
        .attr('transform', () => {
          let x = leftX + nodeLength$5 + (4 * hSpaceAroundGap$2 * gapRatio$2 + pixelWidth) / 2;
          let y = (svgPaddings$3.top + vSpaceAroundGap$3) / 2 - 5;
          return `translate(${x}, ${y})`;
        })
        .attr('class', 'layer-detailed-label')
        .classed('hidden', !detailedMode$2)
        .style('cursor', 'help')
        .on('click', () => {
          d3.event.stopPropagation();
          // Scroll to the article element
          let anchor = document.querySelector(`#article-flatten`);
          scroll.animateScroll(anchor);
        });
      
      detailedLabelGroup.append('title')
        .text('Move to article section');

      let detailedLabelText = detailedLabelGroup.append('text')
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .style('opacity', '0.7')
        .style('font-weight', 800)
        .append('tspan')
        .text('flatten');
      
      let dimension = cnn$2[layerIndexDict['max_pool_2']].length * 
        cnn$2[layerIndexDict['max_pool_2']][0].output.length *
        cnn$2[layerIndexDict['max_pool_2']][0].output[0].length;

      detailedLabelText.append('tspan')
        .attr('x', 0)
        .attr('dy', '1.5em')
        .style('font-size', '8px')
        .style('font-weight', 'normal')
        .text(`(${dimension})`);

      // Add edges between nodes
      let edgeGroup = flattenLayerLeftPart.append('g')
        .attr('class', 'edge-group')
        .lower();
      
      edgeGroup.selectAll('path')
        .data(linkData)
        .enter()
        .append('path')
        .attr('class', d => d.class)
        .attr('id', d => `edge-${d.name}`)
        .attr('d', d => linkGen({source: d.source, target: d.target}))
        .style('fill', 'none')
        .style('stroke-width', d => d.width)
        .style('stroke', d => d.color === undefined ? intermediateColor$2 : d.color)
        .style('opacity', d => d.opacity);
      
      edgeGroup.selectAll('path.flatten-abstract-output')
        .lower();

      edgeGroup.selectAll('path.flatten,path.flatten-output')
        .style('cursor', 'crosshair')
        .style('pointer-events', 'all')
        .on('mouseover', flattenMouseOverHandler)
        .on('mouseleave', flattenMouseLeaveHandler)
        .on('click', () => { d3.event.stopPropagation(); });
      
      // Add legend
      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: range,
        minMax: cnnLayerMinMax$2[10],
        group: intermediateLayer,
        width: intermediateGap + nodeLength$5 - 3,
        x: leftX,
        y: svgPaddings$3.top + vSpaceAroundGap$3 * (10) + vSpaceAroundGap$3 +
          nodeLength$5 * 10
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: flattenRange,
        minMax: {min: flattenExtent[0], max: flattenExtent[1]},
        group: intermediateLayer,
        width: intermediateGap - 3 - 5,
        gradientAppendingName: 'flatten-weight-gradient',
        gradientGap: 0.1,
        colorScale: layerColorScales$5.weight,
        x: leftX + intermediateGap + nodeLength$5 + pixelWidth + 3,
        y: svgPaddings$3.top + vSpaceAroundGap$3 * (10) + vSpaceAroundGap$3 +
          nodeLength$5 * 10
      });

      // Add annotation to the intermediate layer
      let intermediateLayerAnnotation = svg$4.append('g')
        .attr('class', 'intermediate-layer-annotation')
        .style('opacity', 0);

      // Add annotation for the sum operation
      let plusAnnotation = intermediateLayerAnnotation.append('g')
        .attr('class', 'plus-annotation');
      
      // let textX = nodeCoordinate[curLayerIndex][i].x - 50;
      let textX = intermediateX2;
      let textY = nodeCoordinate$2[curLayerIndex][i].y + nodeLength$5 +
        kernelRectLength$1 * 3;
      let arrowSY = nodeCoordinate$2[curLayerIndex][i].y + nodeLength$5 +
        kernelRectLength$1 * 2;
      let arrowTY = nodeCoordinate$2[curLayerIndex][i].y + nodeLength$5 / 2 +
        plusSymbolRadius$1;

      if (i == 9) {
        textY -= 110;
        arrowSY -= 70;
        arrowTY -= 18;
      }

      let plusText = plusAnnotation.append('text')
        .attr('x', textX)
        .attr('y', textY)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'hanging')
        .style('text-anchor', 'middle');
      
      plusText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text('Add up all products');
      
      plusText.append('tspan')
        .attr('x', textX)
        .attr('dy', '1em')
        .style('dominant-baseline', 'hanging')
        .text('(');

      plusText.append('tspan')
        .style('fill', '#66a3c8')
        .style('dominant-baseline', 'hanging')
        .text('element');

      plusText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text(' × ');

      plusText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .style('fill', '#b58946')
        .text('weight');

      plusText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text(')');

      plusText.append('tspan')
        .attr('x', textX)
        .attr('dy', '1em')
        .style('dominant-baseline', 'hanging')
        .text('and then ');

      plusText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .style('fill', '#479d94')
        .text('bias');
      
      drawArrow({
        group: plusAnnotation,
        sx: intermediateX2 - 2 * plusSymbolRadius$1 - 3,
        sy: arrowSY,
        tx: intermediateX2 - 5,
        ty: arrowTY,
        dr: 30,
        hFlip: i === 9,
        marker: 'marker-alt'
      });

      // Add annotation for the bias
      let biasTextY = nodeCoordinate$2[curLayerIndex][i].y;
      biasTextY -= 2 * kernelRectLength$1 + 4;
      
      flattenLayerLeftPart.append('text')
        .attr('class', 'annotation-text')
        .attr('x', intermediateX2 + plusSymbolRadius$1)
        .attr('y', biasTextY)
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'baseline')
        .text('Bias');
      
      // Add annotation for the softmax symbol
      let softmaxAnnotation = intermediateLayerAnnotation.append('g')
        .attr('class', 'softmax-annotation');
      
      softmaxAnnotation.append('text')
        .attr('x', softmaxX + softmaxWidth / 2)
        .attr('y', softmaxTextY)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'baseline')
        .style('text-anchor', 'middle')
        .style('font-weight', 700)
        .text('Click ')
        .append('tspan')
        .attr('dx', 1)
        .style('font-weight', 400)
        .text('to learn more');

      drawArrow({
        group: softmaxAnnotation,
        sx: softmaxX + softmaxWidth / 2 - 5,
        sy: softmaxTextY + 4,
        tx: softmaxX + softmaxWidth / 2,
        ty: symbolY - plusSymbolRadius$1 - 4,
        dr: 50,
        hFlip: true
      });

      // Add annotation for the flatten layer
      let flattenAnnotation = intermediateLayerAnnotation.append('g')
        .attr('class', 'flatten-annotation');
      
      textX = leftX - 80;
      textY = nodeCoordinate$2[curLayerIndex - 1][0].y;

      let flattenText = flattenAnnotation.append('text')
        .attr('x', textX)
        .attr('y', textY)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'hanging')
        .style('text-anchor', 'middle');

      let tempTspan = flattenText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .style('font-weight', 700)
        .text('Hover over ');
      
      tempTspan.append('tspan')
        .attr('dx', 1)
        .style('font-weight', 400)
        .style('dominant-baseline', 'hanging')
        .text('matrix to');
      
      flattenText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .attr('x', textX)
        .attr('dy', '1em')
        .text('see how it is flattened');
      
      flattenText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .attr('x', textX)
        .attr('dy', '1em')
        .text('into a 1D array!');

      drawArrow({
        group: flattenAnnotation,
        sx: textX + 45,
        sy: textY + nodeLength$5 * 0.4 + 12,
        tx: leftX - 10,
        ty: textY + nodeLength$5 / 2,
        dr: 80,
        hFlip: true
      });

      // Add annotation to explain the middle images
      textY = nodeCoordinate$2[curLayerIndex - 1][1].y;

      let middleText = flattenAnnotation.append('text')
        .attr('x', textX)
        .attr('y', textY)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'hanging')
        .style('text-anchor', 'middle');

      middleText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text('Same flattening');
      
      middleText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .attr('x', textX)
        .attr('dy', '1em')
        .text('operation for');

      middleText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .attr('x', textX)
        .attr('dy', '1em')
        .text('each neuron');

      drawArrow({
        group: flattenAnnotation,
        sx: textX + 39,
        sy: textY + 25,
        tx: leftX - 10,
        ty: textY + nodeLength$5 / 2 - 2,
        dr: 80,
        hFlip: true,
        marker: 'marker-alt'
      });


      // Add annotation for the output neuron
      let outputAnnotation = intermediateLayerAnnotation.append('g')
        .attr('class', 'output-annotation');
      
      outputAnnotation.append('text')
        .attr('x', nodeCoordinate$2[layerIndexDict['output']][i].x)
        .attr('y', nodeCoordinate$2[layerIndexDict['output']][i].y + 10)
        .attr('class', 'annotation-text')
        .text(`(${d3.format('.4f')(cnn$2[layerIndexDict['output']][i].output)})`);


      /* Prototype of using arc to represent the flatten layer (future)
      let pie = d3.pie()
        .padAngle(0)
        .sort(null)
        .value(d => d.output)
        .startAngle(0)
        .endAngle(-Math.PI);

      let radius = 490 / 2;
      let arc = d3.arc()
        .innerRadius(radius - 20)
        .outerRadius(radius);

      let arcs = pie(cnn.flatten);
      console.log(arcs);

      let test = svg.append('g')
        .attr('class', 'test')
        .attr('transform', 'translate(500, 250)');

      test.selectAll("path")
        .data(arcs)
        .join("path")
          .attr('class', 'arc')
          .attr("fill", d => colorScale((d.value + range/2) / range))
          .attr("d", arc);
      */

      // Show everything
      svg$4.selectAll('g.intermediate-layer, g.intermediate-layer-annotation')
        .transition()
        .delay(500)
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /* src\overview\Cnn.svelte generated by Svelte v3.47.0 */

    const { Object: Object_1, console: console_1$2 } = globals;

    const file$b = "src\\overview\\Cnn.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[84] = list[i];
    	child_ctx[86] = i;
    	return child_ctx;
    }

    // (1498:6) {#each imageOptions as image, i}
    function create_each_block(ctx) {
    	let div;
    	let img;
    	let img_src_value;
    	let img_title_value;
    	let img_data_imagename_value;
    	let div_data_imagename_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/" + /*image*/ ctx[84].file)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "image option");
    			attr_dev(img, "title", img_title_value = /*image*/ ctx[84].class);
    			attr_dev(img, "data-imagename", img_data_imagename_value = /*image*/ ctx[84].file);
    			attr_dev(img, "class", "svelte-9lm4l0");
    			add_location(img, file$b, 1503, 10, 47706);
    			attr_dev(div, "class", "image-container svelte-9lm4l0");
    			attr_dev(div, "data-imagename", div_data_imagename_value = /*image*/ ctx[84].file);
    			toggle_class(div, "inactive", /*selectedImage*/ ctx[7] !== /*image*/ ctx[84].file);
    			toggle_class(div, "disabled", /*disableControl*/ ctx[6]);
    			add_location(div, file$b, 1498, 8, 47462);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);

    			if (!mounted) {
    				dispose = listen_dev(
    					div,
    					"click",
    					function () {
    						if (is_function(/*disableControl*/ ctx[6]
    						? click_handler
    						: /*imageOptionClicked*/ ctx[17])) (/*disableControl*/ ctx[6]
    						? click_handler
    						: /*imageOptionClicked*/ ctx[17]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*selectedImage, imageOptions*/ 32896) {
    				toggle_class(div, "inactive", /*selectedImage*/ ctx[7] !== /*image*/ ctx[84].file);
    			}

    			if (dirty[0] & /*disableControl*/ 64) {
    				toggle_class(div, "disabled", /*disableControl*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(1498:6) {#each imageOptions as image, i}",
    		ctx
    	});

    	return block;
    }

    // (1511:6) {#if overviewConfig.modeImg == 3}
    function create_if_block_4(ctx) {
    	let div;
    	let img;
    	let img_src_value;
    	let t0;
    	let span;
    	let i0;
    	let t1;
    	let i1;
    	let div_data_imagename_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			t0 = space();
    			span = element("span");
    			i0 = element("i");
    			t1 = space();
    			i1 = element("i");
    			attr_dev(img, "class", "custom-image svelte-9lm4l0");
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/plus.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "plus button");
    			attr_dev(img, "title", "Add new input image");
    			attr_dev(img, "data-imagename", "custom");
    			add_location(img, file$b, 1518, 10, 48209);
    			attr_dev(i0, "class", "fas fa-circle fa-stack-2x");
    			add_location(i0, file$b, 1526, 12, 48500);
    			attr_dev(i1, "class", "fas fa-pen fa-stack-1x fa-inverse");
    			add_location(i1, file$b, 1527, 12, 48554);
    			attr_dev(span, "class", "fa-stack edit-icon svelte-9lm4l0");
    			toggle_class(span, "hidden", /*customImageURL*/ ctx[12] === null);
    			add_location(span, file$b, 1524, 10, 48403);
    			attr_dev(div, "class", "image-container svelte-9lm4l0");
    			attr_dev(div, "data-imagename", div_data_imagename_value = 'custom');
    			toggle_class(div, "inactive", /*selectedImage*/ ctx[7] !== 'custom');
    			toggle_class(div, "disabled", /*disableControl*/ ctx[6]);
    			add_location(div, file$b, 1512, 8, 47968);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			append_dev(div, t0);
    			append_dev(div, span);
    			append_dev(span, i0);
    			append_dev(span, t1);
    			append_dev(span, i1);

    			if (!mounted) {
    				dispose = listen_dev(
    					div,
    					"click",
    					function () {
    						if (is_function(/*disableControl*/ ctx[6]
    						? click_handler_1
    						: /*customImageClicked*/ ctx[18])) (/*disableControl*/ ctx[6]
    						? click_handler_1
    						: /*customImageClicked*/ ctx[18]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*customImageURL*/ 4096) {
    				toggle_class(span, "hidden", /*customImageURL*/ ctx[12] === null);
    			}

    			if (dirty[0] & /*selectedImage*/ 128) {
    				toggle_class(div, "inactive", /*selectedImage*/ ctx[7] !== 'custom');
    			}

    			if (dirty[0] & /*disableControl*/ 64) {
    				toggle_class(div, "disabled", /*disableControl*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(1511:6) {#if overviewConfig.modeImg == 3}",
    		ctx
    	});

    	return block;
    }

    // (1614:39) 
    function create_if_block_3(ctx) {
    	let softmaxview;
    	let current;

    	softmaxview = new Softmaxview({
    			props: {
    				logits: /*softmaxDetailViewInfo*/ ctx[3].logits,
    				logitColors: /*softmaxDetailViewInfo*/ ctx[3].logitColors,
    				selectedI: /*softmaxDetailViewInfo*/ ctx[3].selectedI,
    				highlightI: /*softmaxDetailViewInfo*/ ctx[3].highlightI,
    				outputName: /*softmaxDetailViewInfo*/ ctx[3].outputName,
    				outputValue: /*softmaxDetailViewInfo*/ ctx[3].outputValue,
    				startAnimation: /*softmaxDetailViewInfo*/ ctx[3].startAnimation
    			},
    			$$inline: true
    		});

    	softmaxview.$on("xClicked", /*handleExitFromDetiledSoftmaxView*/ ctx[24]);
    	softmaxview.$on("mouseOver", softmaxDetailViewMouseOverHandler);
    	softmaxview.$on("mouseLeave", softmaxDetailViewMouseLeaveHandler);

    	const block = {
    		c: function create() {
    			create_component(softmaxview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(softmaxview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const softmaxview_changes = {};
    			if (dirty[0] & /*softmaxDetailViewInfo*/ 8) softmaxview_changes.logits = /*softmaxDetailViewInfo*/ ctx[3].logits;
    			if (dirty[0] & /*softmaxDetailViewInfo*/ 8) softmaxview_changes.logitColors = /*softmaxDetailViewInfo*/ ctx[3].logitColors;
    			if (dirty[0] & /*softmaxDetailViewInfo*/ 8) softmaxview_changes.selectedI = /*softmaxDetailViewInfo*/ ctx[3].selectedI;
    			if (dirty[0] & /*softmaxDetailViewInfo*/ 8) softmaxview_changes.highlightI = /*softmaxDetailViewInfo*/ ctx[3].highlightI;
    			if (dirty[0] & /*softmaxDetailViewInfo*/ 8) softmaxview_changes.outputName = /*softmaxDetailViewInfo*/ ctx[3].outputName;
    			if (dirty[0] & /*softmaxDetailViewInfo*/ 8) softmaxview_changes.outputValue = /*softmaxDetailViewInfo*/ ctx[3].outputValue;
    			if (dirty[0] & /*softmaxDetailViewInfo*/ 8) softmaxview_changes.startAnimation = /*softmaxDetailViewInfo*/ ctx[3].startAnimation;
    			softmaxview.$set(softmaxview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(softmaxview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(softmaxview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(softmaxview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(1614:39) ",
    		ctx
    	});

    	return block;
    }

    // (1609:67) 
    function create_if_block_2(ctx) {
    	let poolview;
    	let current;

    	poolview = new Poolview({
    			props: {
    				input: /*nodeData*/ ctx[8][0].input,
    				kernelLength: 2,
    				dataRange: /*nodeData*/ ctx[8].colorRange,
    				isExited: /*isExitedFromDetailedView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	poolview.$on("message", /*handleExitFromDetiledPoolView*/ ctx[22]);

    	const block = {
    		c: function create() {
    			create_component(poolview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(poolview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const poolview_changes = {};
    			if (dirty[0] & /*nodeData*/ 256) poolview_changes.input = /*nodeData*/ ctx[8][0].input;
    			if (dirty[0] & /*nodeData*/ 256) poolview_changes.dataRange = /*nodeData*/ ctx[8].colorRange;
    			if (dirty[0] & /*isExitedFromDetailedView*/ 1024) poolview_changes.isExited = /*isExitedFromDetailedView*/ ctx[10];
    			poolview.$set(poolview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(poolview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(poolview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(poolview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(1609:67) ",
    		ctx
    	});

    	return block;
    }

    // (1604:67) 
    function create_if_block_1(ctx) {
    	let activationview;
    	let current;

    	activationview = new Activationview({
    			props: {
    				input: /*nodeData*/ ctx[8][0].input,
    				output: /*nodeData*/ ctx[8][0].output,
    				dataRange: /*nodeData*/ ctx[8].colorRange,
    				isExited: /*isExitedFromDetailedView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	activationview.$on("message", /*handleExitFromDetiledActivationView*/ ctx[23]);

    	const block = {
    		c: function create() {
    			create_component(activationview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(activationview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const activationview_changes = {};
    			if (dirty[0] & /*nodeData*/ 256) activationview_changes.input = /*nodeData*/ ctx[8][0].input;
    			if (dirty[0] & /*nodeData*/ 256) activationview_changes.output = /*nodeData*/ ctx[8][0].output;
    			if (dirty[0] & /*nodeData*/ 256) activationview_changes.dataRange = /*nodeData*/ ctx[8].colorRange;
    			if (dirty[0] & /*isExitedFromDetailedView*/ 1024) activationview_changes.isExited = /*isExitedFromDetailedView*/ ctx[10];
    			activationview.$set(activationview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(activationview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(activationview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(activationview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(1604:67) ",
    		ctx
    	});

    	return block;
    }

    // (1596:2) {#if selectedNode.data && selectedNode.data.type === 'conv' && selectedNodeIndex != -1}
    function create_if_block$3(ctx) {
    	let convolutionview;
    	let current;

    	convolutionview = new Convolutionview({
    			props: {
    				input: /*nodeData*/ ctx[8][/*selectedNodeIndex*/ ctx[9]].input,
    				kernel: /*nodeData*/ ctx[8][/*selectedNodeIndex*/ ctx[9]].kernel,
    				dataRange: /*nodeData*/ ctx[8].colorRange,
    				colorScale: /*nodeData*/ ctx[8].inputIsInputLayer
    				? /*layerColorScales*/ ctx[14].input[0]
    				: /*layerColorScales*/ ctx[14].conv,
    				isInputInputLayer: /*nodeData*/ ctx[8].inputIsInputLayer,
    				isExited: /*isExitedFromCollapse*/ ctx[11]
    			},
    			$$inline: true
    		});

    	convolutionview.$on("message", /*handleExitFromDetiledConvView*/ ctx[21]);

    	const block = {
    		c: function create() {
    			create_component(convolutionview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(convolutionview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const convolutionview_changes = {};
    			if (dirty[0] & /*nodeData, selectedNodeIndex*/ 768) convolutionview_changes.input = /*nodeData*/ ctx[8][/*selectedNodeIndex*/ ctx[9]].input;
    			if (dirty[0] & /*nodeData, selectedNodeIndex*/ 768) convolutionview_changes.kernel = /*nodeData*/ ctx[8][/*selectedNodeIndex*/ ctx[9]].kernel;
    			if (dirty[0] & /*nodeData*/ 256) convolutionview_changes.dataRange = /*nodeData*/ ctx[8].colorRange;

    			if (dirty[0] & /*nodeData*/ 256) convolutionview_changes.colorScale = /*nodeData*/ ctx[8].inputIsInputLayer
    			? /*layerColorScales*/ ctx[14].input[0]
    			: /*layerColorScales*/ ctx[14].conv;

    			if (dirty[0] & /*nodeData*/ 256) convolutionview_changes.isInputInputLayer = /*nodeData*/ ctx[8].inputIsInputLayer;
    			if (dirty[0] & /*isExitedFromCollapse*/ 2048) convolutionview_changes.isExited = /*isExitedFromCollapse*/ ctx[11];
    			convolutionview.$set(convolutionview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(convolutionview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(convolutionview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(convolutionview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(1596:2) {#if selectedNode.data && selectedNode.data.type === 'conv' && selectedNodeIndex != -1}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let div6;
    	let div4;
    	let div0;
    	let t0;
    	let t1;
    	let button0;
    	let span0;
    	let i0;
    	let t2;
    	let span1;
    	let t3_value = /*hoverInfo*/ ctx[4].text + "";
    	let t3;
    	let t4;
    	let div3;
    	let button1;
    	let span2;
    	let i1;
    	let t5;
    	let span3;
    	let t7;
    	let button2;
    	let span4;
    	let i2;
    	let t8;
    	let span5;
    	let t10;
    	let div2;
    	let span6;
    	let i3;
    	let t11;
    	let div1;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let t15;
    	let div5;
    	let svg_1;
    	let t16;
    	let div7;
    	let current_block_type_index;
    	let if_block1;
    	let t17;
    	let modal;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*imageOptions*/ ctx[15];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let if_block0 = overviewConfig.modeImg == 3 && create_if_block_4(ctx);
    	const if_block_creators = [create_if_block$3, create_if_block_1, create_if_block_2, create_if_block_3];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*selectedNode*/ ctx[5].data && /*selectedNode*/ ctx[5].data.type === 'conv' && /*selectedNodeIndex*/ ctx[9] != -1) return 0;
    		if (/*selectedNode*/ ctx[5].data && /*selectedNode*/ ctx[5].data.type === 'relu') return 1;
    		if (/*selectedNode*/ ctx[5].data && /*selectedNode*/ ctx[5].data.type === 'pool') return 2;
    		if (/*softmaxDetailViewInfo*/ ctx[3].show) return 3;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	modal = new Modal({ $$inline: true });
    	modal.$on("xClicked", /*handleModalCanceled*/ ctx[19]);
    	modal.$on("urlTyped", /*handleCustomImage*/ ctx[20]);

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div4 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			button0 = element("button");
    			span0 = element("span");
    			i0 = element("i");
    			t2 = space();
    			span1 = element("span");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			button1 = element("button");
    			span2 = element("span");
    			i1 = element("i");
    			t5 = space();
    			span3 = element("span");
    			span3.textContent = "Faire le test";
    			t7 = space();
    			button2 = element("button");
    			span4 = element("span");
    			i2 = element("i");
    			t8 = space();
    			span5 = element("span");
    			span5.textContent = "Détail";
    			t10 = space();
    			div2 = element("div");
    			span6 = element("span");
    			i3 = element("i");
    			t11 = space();
    			div1 = element("div");
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Unit";
    			option1 = element("option");
    			option1.textContent = "Module";
    			option2 = element("option");
    			option2.textContent = "Global";
    			t15 = space();
    			div5 = element("div");
    			svg_1 = svg_element("svg");
    			t16 = space();
    			div7 = element("div");
    			if (if_block1) if_block1.c();
    			t17 = space();
    			create_component(modal.$$.fragment);
    			attr_dev(i0, "class", "fas fa-crosshairs ");
    			add_location(i0, file$b, 1536, 10, 48850);
    			attr_dev(span0, "class", "icon");
    			set_style(span0, "margin-right", "5px");
    			add_location(span0, file$b, 1535, 8, 48793);
    			attr_dev(span1, "id", "hover-label-text");
    			add_location(span1, file$b, 1538, 8, 48909);
    			attr_dev(button0, "class", "button is-very-small is-link is-light svelte-9lm4l0");
    			attr_dev(button0, "id", "hover-label");
    			set_style(button0, "opacity", /*hoverInfo*/ ctx[4].show ? 1 : 0);
    			add_location(button0, file$b, 1532, 6, 48656);
    			attr_dev(div0, "class", "left-control svelte-9lm4l0");
    			add_location(div0, file$b, 1496, 4, 47388);
    			attr_dev(i1, "class", "fa-solid fa-address-card");
    			add_location(i1, file$b, 1548, 10, 49174);
    			attr_dev(span2, "class", "icon");
    			add_location(span2, file$b, 1547, 8, 49144);
    			add_location(span3, file$b, 1550, 12, 49243);
    			attr_dev(button1, "class", "button is-success is-very-small is-activated svelte-9lm4l0");
    			add_location(button1, file$b, 1546, 8, 49050);
    			attr_dev(i2, "class", "fas fa-eye");
    			add_location(i2, file$b, 1562, 10, 49552);
    			attr_dev(span4, "class", "icon");
    			add_location(span4, file$b, 1561, 8, 49522);
    			attr_dev(span5, "id", "hover-label-text");
    			add_location(span5, file$b, 1564, 8, 49603);
    			attr_dev(button2, "class", "button blue-button is-very-small svelte-9lm4l0");
    			attr_dev(button2, "id", "detailed-button");
    			button2.disabled = /*disableControl*/ ctx[6];
    			toggle_class(button2, "is-activated", /*detailedMode*/ ctx[2]);
    			add_location(button2, file$b, 1556, 8, 49318);
    			attr_dev(i3, "class", "fas fa-palette");
    			add_location(i3, file$b, 1572, 10, 49826);
    			attr_dev(span6, "class", "icon is-left");
    			add_location(span6, file$b, 1571, 8, 49788);
    			option0.__value = "local";
    			option0.value = option0.__value;
    			add_location(option0, file$b, 1578, 12, 50022);
    			option1.__value = "module";
    			option1.value = option1.__value;
    			add_location(option1, file$b, 1579, 12, 50070);
    			option2.__value = "global";
    			option2.value = option2.__value;
    			add_location(option2, file$b, 1580, 12, 50121);
    			attr_dev(select, "id", "level-select");
    			select.disabled = /*disableControl*/ ctx[6];
    			attr_dev(select, "class", "svelte-9lm4l0");
    			if (/*selectedScaleLevel*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[25].call(select));
    			add_location(select, file$b, 1576, 10, 49913);
    			attr_dev(div1, "class", "select svelte-9lm4l0");
    			add_location(div1, file$b, 1575, 8, 49882);
    			attr_dev(div2, "class", "control is-very-small has-icons-left svelte-9lm4l0");
    			attr_dev(div2, "title", "Change color scale range");
    			add_location(div2, file$b, 1569, 6, 49688);
    			attr_dev(div3, "class", "right-control svelte-9lm4l0");
    			add_location(div3, file$b, 1544, 4, 49013);
    			attr_dev(div4, "class", "control-container svelte-9lm4l0");
    			add_location(div4, file$b, 1494, 2, 47351);
    			attr_dev(svg_1, "id", "cnn-svg");
    			attr_dev(svg_1, "class", "svelte-9lm4l0");
    			add_location(svg_1, file$b, 1590, 4, 50259);
    			attr_dev(div5, "class", "cnn svelte-9lm4l0");
    			add_location(div5, file$b, 1589, 2, 50237);
    			attr_dev(div6, "class", "overview svelte-9lm4l0");
    			add_location(div6, file$b, 1491, 0, 47293);
    			attr_dev(div7, "id", "detailview");
    			add_location(div7, file$b, 1594, 0, 50301);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div4);
    			append_dev(div4, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div0, t0);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(div0, t1);
    			append_dev(div0, button0);
    			append_dev(button0, span0);
    			append_dev(span0, i0);
    			append_dev(button0, t2);
    			append_dev(button0, span1);
    			append_dev(span1, t3);
    			append_dev(div4, t4);
    			append_dev(div4, div3);
    			append_dev(div3, button1);
    			append_dev(button1, span2);
    			append_dev(span2, i1);
    			append_dev(button1, t5);
    			append_dev(button1, span3);
    			append_dev(div3, t7);
    			append_dev(div3, button2);
    			append_dev(button2, span4);
    			append_dev(span4, i2);
    			append_dev(button2, t8);
    			append_dev(button2, span5);
    			append_dev(div3, t10);
    			append_dev(div3, div2);
    			append_dev(div2, span6);
    			append_dev(span6, i3);
    			append_dev(div2, t11);
    			append_dev(div2, div1);
    			append_dev(div1, select);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			select_option(select, /*selectedScaleLevel*/ ctx[0]);
    			append_dev(div6, t15);
    			append_dev(div6, div5);
    			append_dev(div5, svg_1);
    			/*div6_binding*/ ctx[26](div6);
    			insert_dev(target, t16, anchor);
    			insert_dev(target, div7, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div7, null);
    			}

    			insert_dev(target, t17, anchor);
    			mount_component(modal, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button1, "click", /*afficheStart*/ ctx[13], false, false, false),
    					listen_dev(button2, "click", /*detailedButtonClicked*/ ctx[16], false, false, false),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[25])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*imageOptions, selectedImage, disableControl, imageOptionClicked*/ 164032) {
    				each_value = /*imageOptions*/ ctx[15];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, t0);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (overviewConfig.modeImg == 3) if_block0.p(ctx, dirty);
    			if ((!current || dirty[0] & /*hoverInfo*/ 16) && t3_value !== (t3_value = /*hoverInfo*/ ctx[4].text + "")) set_data_dev(t3, t3_value);

    			if (!current || dirty[0] & /*hoverInfo*/ 16) {
    				set_style(button0, "opacity", /*hoverInfo*/ ctx[4].show ? 1 : 0);
    			}

    			if (!current || dirty[0] & /*disableControl*/ 64) {
    				prop_dev(button2, "disabled", /*disableControl*/ ctx[6]);
    			}

    			if (dirty[0] & /*detailedMode*/ 4) {
    				toggle_class(button2, "is-activated", /*detailedMode*/ ctx[2]);
    			}

    			if (!current || dirty[0] & /*disableControl*/ 64) {
    				prop_dev(select, "disabled", /*disableControl*/ ctx[6]);
    			}

    			if (dirty[0] & /*selectedScaleLevel*/ 1) {
    				select_option(select, /*selectedScaleLevel*/ ctx[0]);
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block1) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block1 = if_blocks[current_block_type_index];

    					if (!if_block1) {
    						if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block1.c();
    					} else {
    						if_block1.p(ctx, dirty);
    					}

    					transition_in(if_block1, 1);
    					if_block1.m(div7, null);
    				} else {
    					if_block1 = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block1);
    			transition_in(modal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block1);
    			transition_out(modal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			destroy_each(each_blocks, detaching);
    			if (if_block0) if_block0.d();
    			/*div6_binding*/ ctx[26](null);
    			if (detaching) detach_dev(t16);
    			if (detaching) detach_dev(div7);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			if (detaching) detach_dev(t17);
    			destroy_component(modal, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const click_handler = () => {
    	
    };

    const click_handler_1 = () => {
    	
    };

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Cnn', slots, []);

    	function afficheStart() {
    		leftStartStore.update(n => 0);
    	}

    	// View bindings
    	let overviewComponent;

    	let scaleLevelSet = new Set(['local', 'module', 'global']);
    	let selectedScaleLevel = 'local';
    	selectedScaleLevelStore.set(selectedScaleLevel);
    	let previousSelectedScaleLevel = selectedScaleLevel;
    	let wholeSvg = undefined;
    	let svg = undefined;

    	// Configs
    	const layerColorScales = overviewConfig.layerColorScales;

    	const nodeLength = overviewConfig.nodeLength;
    	const plusSymbolRadius = overviewConfig.plusSymbolRadius;
    	const numLayers = overviewConfig.numLayers;
    	const edgeOpacity = overviewConfig.edgeOpacity;
    	const edgeInitColor = overviewConfig.edgeInitColor;
    	const edgeHoverColor = overviewConfig.edgeHoverColor;
    	const edgeHoverOuting = overviewConfig.edgeHoverOuting;
    	const edgeStrokeWidth = overviewConfig.edgeStrokeWidth;
    	const intermediateColor = overviewConfig.intermediateColor;
    	const kernelRectLength = overviewConfig.kernelRectLength;
    	const svgPaddings = overviewConfig.svgPaddings;
    	const gapRatio = overviewConfig.gapRatio;
    	const overlayRectOffset = overviewConfig.overlayRectOffset;
    	const classLists = overviewConfig.classLists;

    	// Shared properties
    	let needRedraw = [undefined, undefined];

    	needRedrawStore.subscribe(value => {
    		needRedraw = value;
    	});

    	let nodeCoordinate = undefined;

    	nodeCoordinateStore.subscribe(value => {
    		nodeCoordinate = value;
    	});

    	let cnnLayerRanges = undefined;

    	cnnLayerRangesStore.subscribe(value => {
    		cnnLayerRanges = value;
    	});

    	let cnnLayerMinMax = undefined;

    	cnnLayerMinMaxStore.subscribe(value => {
    		cnnLayerMinMax = value;
    	});

    	let detailedMode = undefined;

    	detailedModeStore.subscribe(value => {
    		$$invalidate(2, detailedMode = value);
    	});

    	let shouldIntermediateAnimate = undefined;

    	shouldIntermediateAnimateStore.subscribe(value => {
    		shouldIntermediateAnimate = value;
    	});

    	let vSpaceAroundGap = undefined;

    	vSpaceAroundGapStore.subscribe(value => {
    		vSpaceAroundGap = value;
    	});

    	let hSpaceAroundGap = undefined;

    	hSpaceAroundGapStore.subscribe(value => {
    		hSpaceAroundGap = value;
    	});

    	let isInSoftmax = undefined;

    	isInSoftmaxStore.subscribe(value => {
    		isInSoftmax = value;
    	});

    	let softmaxDetailViewInfo = undefined;

    	softmaxDetailViewStore.subscribe(value => {
    		$$invalidate(3, softmaxDetailViewInfo = value);
    	});

    	let modalInfo = undefined;

    	modalStore.subscribe(value => {
    		modalInfo = value;
    	});

    	let hoverInfo = undefined;

    	hoverInfoStore.subscribe(value => {
    		$$invalidate(4, hoverInfo = value);
    	});

    	let intermediateLayerPosition = undefined;

    	intermediateLayerPositionStore.subscribe(value => {
    		intermediateLayerPosition = value;
    	});

    	let width = undefined;
    	let height = undefined;
    	let model = undefined;
    	let selectedNode = { layerName: '', index: -1, data: null };
    	let isInIntermediateView = false;
    	let isInActPoolDetailView = false;
    	let actPoolDetailViewNodeIndex = -1;
    	let actPoolDetailViewLayerIndex = -1;
    	let detailedViewNum = undefined;
    	let disableControl = false;

    	// Wait to load
    	let cnn = undefined;

    	let detailedViewAbsCoords = {
    		1: [600, 270, 490, 290],
    		2: [500, 270, 490, 290],
    		3: [700, 270, 490, 290],
    		4: [600, 270, 490, 290],
    		5: [650, 270, 490, 290],
    		6: [775, 270, 490, 290],
    		7: [100, 270, 490, 290],
    		8: [60, 270, 490, 290],
    		9: [200, 270, 490, 290],
    		10: [300, 270, 490, 290]
    	};

    	const layerIndexDict = {
    		'input': 0,
    		'conv_1_1': 1,
    		'relu_1_1': 2,
    		'conv_1_2': 3,
    		'relu_1_2': 4,
    		'max_pool_1': 5,
    		'conv_2_1': 6,
    		'relu_2_1': 7,
    		'conv_2_2': 8,
    		'relu_2_2': 9,
    		'max_pool_2': 10,
    		'output': 11
    	};

    	const layerLegendDict = {
    		0: {
    			local: 'input-legend',
    			module: 'input-legend',
    			global: 'input-legend'
    		},
    		1: {
    			local: 'local-legend-0-1',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		2: {
    			local: 'local-legend-0-1',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		3: {
    			local: 'local-legend-0-2',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		4: {
    			local: 'local-legend-0-2',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		5: {
    			local: 'local-legend-0-2',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		6: {
    			local: 'local-legend-1-1',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		7: {
    			local: 'local-legend-1-1',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		8: {
    			local: 'local-legend-1-2',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		9: {
    			local: 'local-legend-1-2',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		10: {
    			local: 'local-legend-1-2',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		11: {
    			local: 'output-legend',
    			module: 'output-legend',
    			global: 'output-legend'
    		}
    	};

    	let imageOptions = [
    		{ file: 'colere.jpg', class: 'Colère' },
    		{ file: 'degout.jpg', class: 'Dégoût' },
    		{ file: 'peur.jpg', class: 'Peur' },
    		{ file: 'joyeux.jpg', class: 'Joyeux' },
    		{ file: 'triste.jpg', class: 'Triste' },
    		{ file: 'surprise.jpg', class: 'Surprise' },
    		{ file: 'neutre.jpg', class: 'Neutre' }
    	];

    	let selectedImage = imageOptions[0].file;
    	let nodeData;
    	let selectedNodeIndex = -1;
    	let isExitedFromDetailedView = true;
    	let isExitedFromCollapse = true;
    	let customImageURL = null;

    	// Helper functions
    	const selectedScaleLevelChanged = () => {
    		if (svg !== undefined) {
    			if (!scaleLevelSet.add(selectedScaleLevel)) {
    				console.error('Encounter unknown scale level!');
    			}

    			// Update nodes and legends
    			if (selectedScaleLevel != previousSelectedScaleLevel) {
    				// We can simply redraw all nodes using the new color scale, or we can
    				// make it faster by only redraw certian nodes
    				let updatingLayerIndexDict = {
    					local: {
    						module: [1, 2, 8, 9, 10],
    						global: [1, 2, 3, 4, 5, 8, 9, 10]
    					},
    					module: {
    						local: [1, 2, 8, 9, 10],
    						global: [1, 2, 3, 4, 5, 8, 9, 10]
    					},
    					global: {
    						local: [1, 2, 3, 4, 5, 8, 9, 10],
    						module: [1, 2, 3, 4, 5]
    					}
    				};

    				let updatingLayerIndex = updatingLayerIndexDict[previousSelectedScaleLevel][selectedScaleLevel];

    				updatingLayerIndex.forEach(l => {
    					let range = cnnLayerRanges[selectedScaleLevel][l];
    					svg.select(`#cnn-layer-group-${l}`).selectAll('.node-image').each((d, i, g) => drawOutput(d, i, g, range));
    				});

    				// Hide previous legend
    				svg.selectAll(`.${previousSelectedScaleLevel}-legend`).classed('hidden', true);

    				// Show selected legends
    				svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', !detailedMode);
    			}

    			previousSelectedScaleLevel = selectedScaleLevel;
    			selectedScaleLevelStore.set(selectedScaleLevel);
    		}
    	};

    	const intermediateNodeMouseOverHandler = (d, i, g) => {
    		if (detailedViewNum !== undefined) {
    			return;
    		}

    		svg.select(`rect#underneath-gateway-${d.index}`).style('opacity', 1);
    	};

    	const intermediateNodeMouseLeaveHandler = (d, i, g) => {
    		// screenshot
    		// return;
    		if (detailedViewNum !== undefined) {
    			return;
    		}

    		svg.select(`rect#underneath-gateway-${d.index}`).style('opacity', 0);
    	};

    	const intermediateNodeClicked = (d, i, g, selectedI, curLayerIndex) => {
    		d3.event.stopPropagation();
    		$$invalidate(11, isExitedFromCollapse = false);

    		// Use this event to trigger the detailed view
    		if (detailedViewNum === d.index) {
    			// Setting this for testing purposes currently.
    			$$invalidate(9, selectedNodeIndex = -1);

    			// User clicks this node again -> rewind
    			detailedViewNum = undefined;

    			svg.select(`rect#underneath-gateway-${d.index}`).style('opacity', 0);
    		} else // We need to show a new detailed view (two cases: if we need to close the
    		// old detailed view or not)
    		{
    			// Setting this for testing purposes currently.
    			$$invalidate(9, selectedNodeIndex = d.index);

    			let inputMatrix = d.output;
    			let kernelMatrix = d.outputLinks[selectedI].weight;

    			// let interMatrix = singleConv(inputMatrix, kernelMatrix);
    			let colorScale = layerColorScales.conv;

    			// Compute the color range
    			let rangePre = cnnLayerRanges[selectedScaleLevel][curLayerIndex - 1];

    			let rangeCur = cnnLayerRanges[selectedScaleLevel][curLayerIndex];
    			let range = Math.max(rangePre, rangeCur);

    			// User triggers a different detailed view
    			if (detailedViewNum !== undefined) {
    				// Change the underneath highlight
    				svg.select(`rect#underneath-gateway-${detailedViewNum}`).style('opacity', 0);

    				svg.select(`rect#underneath-gateway-${d.index}`).style('opacity', 1);
    			}

    			// Dynamically position the detail view
    			let wholeSvg = d3.select('#cnn-svg');

    			let svgYMid = +wholeSvg.style('height').replace('px', '') / 2;
    			let svgWidth = +wholeSvg.style('width').replace('px', '');
    			let detailViewTop = 100 + svgYMid - 250 / 2;
    			let positionX = intermediateLayerPosition[Object.keys(layerIndexDict)[curLayerIndex]];
    			let posX = 0;

    			if (curLayerIndex > 6) {
    				posX = (positionX - svgPaddings.left) / 2;
    				posX = svgPaddings.left + posX - 486 / 2;
    			} else {
    				posX = (svgWidth + svgPaddings.right - positionX) / 2;
    				posX = positionX + posX - 486 / 2;
    			}

    			const detailview = document.getElementById('detailview');
    			detailview.style.top = `${detailViewTop}px`;
    			detailview.style.left = `${posX}px`;
    			detailview.style.position = 'absolute';
    			detailedViewNum = d.index;

    			// Send the currently used color range to detailed view
    			$$invalidate(8, nodeData.colorRange = range, nodeData);

    			$$invalidate(8, nodeData.inputIsInputLayer = curLayerIndex <= 1, nodeData);
    		}
    	};

    	// The order of the if/else statements in this function is very critical
    	const emptySpaceClicked = () => {
    		// If detail view -> rewind to intermediate view
    		if (detailedViewNum !== undefined) {
    			// Setting this for testing purposes currently.
    			$$invalidate(9, selectedNodeIndex = -1);

    			// User clicks this node again -> rewind
    			svg.select(`rect#underneath-gateway-${detailedViewNum}`).style('opacity', 0);

    			detailedViewNum = undefined;
    		} else // If softmax view -> rewind to flatten layer view
    		if (isInSoftmax) {
    			svg.select('.softmax-symbol').dispatch('click');
    		} else // If intermediate view -> rewind to overview
    		if (isInIntermediateView) {
    			let curLayerIndex = layerIndexDict[selectedNode.layerName];
    			quitIntermediateView(curLayerIndex, selectedNode.domG, selectedNode.domI);
    			d3.select(selectedNode.domG[selectedNode.domI]).dispatch('mouseleave');
    		} else // If pool/act detail view -> rewind to overview
    		if (isInActPoolDetailView) {
    			quitActPoolDetailView();
    		}
    	};

    	const prepareToEnterIntermediateView = (d, g, i, curLayerIndex) => {
    		isInIntermediateView = true;

    		// Hide all legends
    		svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', true);

    		svg.selectAll('.input-legend').classed('hidden', true);
    		svg.selectAll('.output-legend').classed('hidden', true);

    		// Hide the input annotation
    		svg.select('.input-annotation').classed('hidden', true);

    		// Highlight the previous layer and this node
    		svg.select(`g#cnn-layer-group-${curLayerIndex - 1}`).selectAll('rect.bounding').style('stroke-width', 2);

    		d3.select(g[i]).select('rect.bounding').style('stroke-width', 2);

    		// Disable control panel UI
    		// d3.select('#level-select').property('disabled', true);
    		// d3.selectAll('.image-container')
    		//   .style('cursor', 'not-allowed')
    		//   .on('mouseclick', () => {});
    		$$invalidate(6, disableControl = true);

    		// Allow infinite animation loop
    		shouldIntermediateAnimateStore.set(true);

    		// Highlight the labels
    		svg.selectAll(`g#layer-label-${curLayerIndex - 1},
      g#layer-detailed-label-${curLayerIndex - 1},
      g#layer-label-${curLayerIndex},
      g#layer-detailed-label-${curLayerIndex}`).style('font-weight', '800');

    		// Register a handler on the svg element so user can click empty space to quit
    		// the intermediate view
    		d3.select('#cnn-svg').on('click', emptySpaceClicked);
    	};

    	const quitActPoolDetailView = () => {
    		isInActPoolDetailView = false;
    		actPoolDetailViewNodeIndex = -1;
    		let layerIndex = layerIndexDict[selectedNode.layerName];
    		let nodeIndex = selectedNode.index;
    		svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', true);

    		selectedNode.data.inputLinks.forEach(link => {
    			let layerIndex = layerIndexDict[link.source.layerName];
    			let nodeIndex = link.source.index;
    			svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', true);
    		});

    		// Clean up the underneath rects
    		svg.select('g.underneath').selectAll('rect').remove();

    		// Show all edges
    		let unimportantEdges = svg.select('g.edge-group').selectAll('.edge').filter(d => {
    			return d.targetLayerIndex !== actPoolDetailViewLayerIndex;
    		}).style('visibility', null);

    		// Recover control UI
    		$$invalidate(6, disableControl = false);

    		// Show legends if in detailed mode
    		svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', !detailedMode);

    		svg.selectAll('.input-legend').classed('hidden', !detailedMode);
    		svg.selectAll('.output-legend').classed('hidden', !detailedMode);

    		// Also dehighlight the edge
    		let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');

    		edgeGroup.selectAll(`path.edge-${layerIndex}-${nodeIndex}`).transition().ease(d3.easeCubicOut).duration(200).style('stroke', edgeInitColor).style('stroke-width', edgeStrokeWidth).style('opacity', edgeOpacity);

    		// Remove the overlay rect
    		svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').transition('remove').duration(500).ease(d3.easeCubicInOut).style('opacity', 0).on('end', (d, i, g) => {
    			svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').remove();
    			svg.selectAll('defs.overlay-gradient').remove();
    			svg.select('.input-annotation').classed('hidden', false);
    		});

    		// Turn the fade out nodes back
    		svg.select(`g#cnn-layer-group-${layerIndex}`).selectAll('g.node-group').each((sd, si, sg) => {
    			d3.select(sg[si]).style('pointer-events', 'all');
    		});

    		svg.select(`g#cnn-layer-group-${layerIndex - 1}`).selectAll('g.node-group').each((sd, si, sg) => {
    			// Recover the old events
    			d3.select(sg[si]).style('pointer-events', 'all').on('mouseover', nodeMouseOverHandler).on('mouseleave', nodeMouseLeaveHandler).on('click', nodeClickHandler);
    		});

    		// Deselect the node
    		$$invalidate(5, selectedNode.layerName = '', selectedNode);

    		$$invalidate(5, selectedNode.index = -1, selectedNode);
    		$$invalidate(5, selectedNode.data = null, selectedNode);
    		actPoolDetailViewLayerIndex = -1;
    	};

    	const actPoolDetailViewPreNodeMouseOverHandler = (d, i, g) => {
    		// Highlight the edges
    		let layerIndex = layerIndexDict[d.layerName];

    		let nodeIndex = d.index;
    		let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    		edgeGroup.selectAll(`path.edge-${actPoolDetailViewLayerIndex}-${nodeIndex}`).raise().transition().ease(d3.easeCubicInOut).duration(400).style('stroke', edgeHoverColor).style('stroke-width', '1').style('opacity', 1);

    		// Highlight its border
    		d3.select(g[i]).select('rect.bounding').classed('hidden', false);

    		// Highlight node's pair
    		let associatedLayerIndex = layerIndex - 1;

    		if (layerIndex === actPoolDetailViewLayerIndex - 1) {
    			associatedLayerIndex = layerIndex + 1;
    		}

    		svg.select(`g#layer-${associatedLayerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', false);
    	};

    	const actPoolDetailViewPreNodeMouseLeaveHandler = (d, i, g) => {
    		// De-highlight the edges
    		let layerIndex = layerIndexDict[d.layerName];

    		let nodeIndex = d.index;
    		let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    		edgeGroup.selectAll(`path.edge-${actPoolDetailViewLayerIndex}-${nodeIndex}`).transition().ease(d3.easeCubicOut).duration(200).style('stroke', edgeInitColor).style('stroke-width', edgeStrokeWidth).style('opacity', edgeOpacity);

    		// De-highlight its border
    		d3.select(g[i]).select('rect.bounding').classed('hidden', true);

    		// De-highlight node's pair
    		let associatedLayerIndex = layerIndex - 1;

    		if (layerIndex === actPoolDetailViewLayerIndex - 1) {
    			associatedLayerIndex = layerIndex + 1;
    		}

    		svg.select(`g#layer-${associatedLayerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', true);
    	};

    	const actPoolDetailViewPreNodeClickHandler = (d, i, g) => {
    		let layerIndex = layerIndexDict[d.layerName];
    		let nodeIndex = d.index;

    		// Click the pre-layer node in detail view has the same effect as clicking
    		// the cur-layer node, which is to open a new detail view window
    		svg.select(`g#layer-${layerIndex + 1}-node-${nodeIndex}`).node().dispatchEvent(new Event('click'));
    	};

    	const enterDetailView = (curLayerIndex, i) => {
    		isInActPoolDetailView = true;
    		actPoolDetailViewNodeIndex = i;
    		actPoolDetailViewLayerIndex = curLayerIndex;

    		// Dynamically position the detail view
    		let wholeSvg = d3.select('#cnn-svg');

    		let svgYMid = +wholeSvg.style('height').replace('px', '') / 2;
    		let svgWidth = +wholeSvg.style('width').replace('px', '');
    		let detailViewTop = 100 + svgYMid - 260 / 2;
    		let posX = 0;

    		if (curLayerIndex > 5) {
    			posX = nodeCoordinate[curLayerIndex - 1][0].x + 50;
    			posX = posX / 2 - 500 / 2;
    		} else {
    			posX = (svgWidth - nodeCoordinate[curLayerIndex][0].x - nodeLength) / 2;
    			posX = nodeCoordinate[curLayerIndex][0].x + nodeLength + posX - 500 / 2;
    		}

    		const detailview = document.getElementById('detailview');
    		detailview.style.top = `${detailViewTop}px`;
    		detailview.style.left = `${posX}px`;
    		detailview.style.position = 'absolute';

    		// Hide all edges
    		let unimportantEdges = svg.select('g.edge-group').selectAll('.edge').filter(d => {
    			return d.targetLayerIndex !== curLayerIndex;
    		}).style('visibility', 'hidden');

    		// Disable UI
    		$$invalidate(6, disableControl = true);

    		// Hide input annotaitons
    		svg.select('.input-annotation').classed('hidden', true);

    		// Hide legends
    		svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', true);

    		svg.selectAll('.input-legend').classed('hidden', true);
    		svg.selectAll('.output-legend').classed('hidden', true);
    		svg.select(`#${layerLegendDict[curLayerIndex][selectedScaleLevel]}`).classed('hidden', false);

    		// Add overlay rects
    		let leftX = nodeCoordinate[curLayerIndex - 1][i].x;

    		// +5 to cover the detailed mode long label
    		let rightStart = nodeCoordinate[curLayerIndex][i].x + nodeLength + 5;

    		// Compute the left and right overlay rect width
    		let rightWidth = width - rightStart - overlayRectOffset / 2;

    		let leftWidth = leftX - nodeCoordinate[0][0].x;

    		// The overlay rects should be symmetric
    		if (rightWidth > leftWidth) {
    			let stops = [
    				{
    					offset: '0%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.85
    				},
    				{
    					offset: '50%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.9
    				},
    				{
    					offset: '100%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 1
    				}
    			];

    			addOverlayGradient('overlay-gradient-right', stops);
    			let leftEndOpacity = 0.85 + (0.95 - 0.85) * (leftWidth / rightWidth);

    			stops = [
    				{
    					offset: '0%',
    					color: 'rgb(250, 250, 250)',
    					opacity: leftEndOpacity
    				},
    				{
    					offset: '100%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.85
    				}
    			];

    			addOverlayGradient('overlay-gradient-left', stops);
    		} else {
    			let stops = [
    				{
    					offset: '0%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 1
    				},
    				{
    					offset: '50%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.9
    				},
    				{
    					offset: '100%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.85
    				}
    			];

    			addOverlayGradient('overlay-gradient-left', stops);
    			let rightEndOpacity = 0.85 + (0.95 - 0.85) * (rightWidth / leftWidth);

    			stops = [
    				{
    					offset: '0%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.85
    				},
    				{
    					offset: '100%',
    					color: 'rgb(250, 250, 250)',
    					opacity: rightEndOpacity
    				}
    			];

    			addOverlayGradient('overlay-gradient-right', stops);
    		}

    		addOverlayRect('overlay-gradient-right', rightStart + overlayRectOffset / 2 + 0.5, 0, rightWidth, height + svgPaddings.top);
    		addOverlayRect('overlay-gradient-left', nodeCoordinate[0][0].x - overlayRectOffset / 2, 0, leftWidth, height + svgPaddings.top);
    		svg.selectAll('rect.overlay').on('click', emptySpaceClicked);

    		// Add underneath rectangles
    		let underGroup = svg.select('g.underneath');

    		let padding = 7;

    		for (let n = 0; n < cnn[curLayerIndex - 1].length; n++) {
    			underGroup.append('rect').attr('class', 'underneath-gateway').attr('id', `underneath-gateway-${n}`).attr('x', nodeCoordinate[curLayerIndex - 1][n].x - padding).attr('y', nodeCoordinate[curLayerIndex - 1][n].y - padding).attr('width', 2 * nodeLength + hSpaceAroundGap + 2 * padding).attr('height', nodeLength + 2 * padding).attr('rx', 10).style('fill', 'rgba(160, 160, 160, 0.3)').style('opacity', 0);

    			// Update the event functions for these two layers
    			svg.select(`g#layer-${curLayerIndex - 1}-node-${n}`).style('pointer-events', 'all').style('cursor', 'pointer').on('mouseover', actPoolDetailViewPreNodeMouseOverHandler).on('mouseleave', actPoolDetailViewPreNodeMouseLeaveHandler).on('click', actPoolDetailViewPreNodeClickHandler);
    		}

    		underGroup.lower();

    		// Highlight the selcted pair
    		underGroup.select(`#underneath-gateway-${i}`).style('opacity', 1);
    	};

    	const quitIntermediateView = (curLayerIndex, g, i) => {
    		// If it is the softmax detail view, quit that view first
    		if (isInSoftmax) {
    			svg.select('.logit-layer').remove();
    			svg.select('.logit-layer-lower').remove();
    			svg.selectAll('.plus-symbol-clone').remove();

    			// Instead of removing the paths, we hide them, so it is faster to load in
    			// the future
    			svg.select('.underneath').selectAll('.logit-lower').style('opacity', 0);

    			softmaxDetailViewStore.set({ show: false, logits: [] });
    			allowsSoftmaxAnimationStore.set(false);
    		}

    		isInSoftmaxStore.set(false);
    		isInIntermediateView = false;

    		// Show the legend
    		svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', !detailedMode);

    		svg.selectAll('.input-legend').classed('hidden', !detailedMode);
    		svg.selectAll('.output-legend').classed('hidden', !detailedMode);

    		// Recover control panel UI
    		$$invalidate(6, disableControl = false);

    		// Recover the input layer node's event
    		for (let n = 0; n < cnn[curLayerIndex - 1].length; n++) {
    			svg.select(`g#layer-${curLayerIndex - 1}-node-${n}`).on('mouseover', nodeMouseOverHandler).on('mouseleave', nodeMouseLeaveHandler).on('click', nodeClickHandler);
    		}

    		// Clean up the underneath rects
    		svg.select('g.underneath').selectAll('rect').remove();

    		detailedViewNum = undefined;

    		// Highlight the previous layer and this node
    		svg.select(`g#cnn-layer-group-${curLayerIndex - 1}`).selectAll('rect.bounding').style('stroke-width', 1);

    		d3.select(g[i]).select('rect.bounding').style('stroke-width', 1);

    		// Highlight the labels
    		svg.selectAll(`g#layer-label-${curLayerIndex - 1},
      g#layer-detailed-label-${curLayerIndex - 1},
      g#layer-label-${curLayerIndex},
      g#layer-detailed-label-${curLayerIndex}`).style('font-weight', 'normal');

    		// Also unclick the node
    		// Record the current clicked node
    		$$invalidate(5, selectedNode.layerName = '', selectedNode);

    		$$invalidate(5, selectedNode.index = -1, selectedNode);
    		$$invalidate(5, selectedNode.data = null, selectedNode);
    		$$invalidate(11, isExitedFromCollapse = true);

    		// Remove the intermediate layer
    		let intermediateLayer = svg.select('g.intermediate-layer');

    		// Kill the infinite animation loop
    		shouldIntermediateAnimateStore.set(false);

    		intermediateLayer.transition('remove').duration(500).ease(d3.easeCubicInOut).style('opacity', 0).on('end', (d, i, g) => {
    			d3.select(g[i]).remove();
    		});

    		// Remove the output node overlay mask
    		svg.selectAll('.overlay-group').remove();

    		// Remove the overlay rect
    		svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').transition('remove').duration(500).ease(d3.easeCubicInOut).style('opacity', 0).on('end', (d, i, g) => {
    			svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').remove();
    			svg.selectAll('defs.overlay-gradient').remove();
    		});

    		// Recover the layer if we have drdrawn it
    		if (needRedraw[0] !== undefined) {
    			let redrawRange = cnnLayerRanges[selectedScaleLevel][needRedraw[0]];

    			if (needRedraw[1] !== undefined) {
    				svg.select(`g#layer-${needRedraw[0]}-node-${needRedraw[1]}`).select('image.node-image').each((d, i, g) => drawOutput(d, i, g, redrawRange));
    			} else {
    				svg.select(`g#cnn-layer-group-${needRedraw[0]}`).selectAll('image.node-image').each((d, i, g) => drawOutput(d, i, g, redrawRange));
    			}
    		}

    		// Move all layers to their original place
    		for (let i = 0; i < numLayers; i++) {
    			moveLayerX({
    				layerIndex: i,
    				targetX: nodeCoordinate[i][0].x,
    				disable: false,
    				delay: 500,
    				opacity: 1
    			});
    		}

    		moveLayerX({
    			layerIndex: numLayers - 2,
    			targetX: nodeCoordinate[numLayers - 2][0].x,
    			opacity: 1,
    			disable: false,
    			delay: 500,
    			onEndFunc: () => {
    				// Show all edges on the last moving animation end
    				svg.select('g.edge-group').style('visibility', 'visible');

    				// Recover the input annotation
    				svg.select('.input-annotation').classed('hidden', false);
    			}
    		});
    	};

    	const nodeClickHandler = (d, i, g) => {
    		d3.event.stopPropagation();
    		let nodeIndex = d.index;

    		// Record the current clicked node
    		$$invalidate(5, selectedNode.layerName = d.layerName, selectedNode);

    		$$invalidate(5, selectedNode.index = d.index, selectedNode);
    		$$invalidate(5, selectedNode.data = d, selectedNode);
    		$$invalidate(5, selectedNode.domI = i, selectedNode);
    		$$invalidate(5, selectedNode.domG = g, selectedNode);

    		// Record data for detailed view.
    		if (d.type === 'conv' || d.type === 'relu' || d.type === 'pool') {
    			let data = [];

    			for (let j = 0; j < d.inputLinks.length; j++) {
    				data.push({
    					input: d.inputLinks[j].source.output,
    					kernel: d.inputLinks[j].weight,
    					output: d.inputLinks[j].dest.output
    				});
    			}

    			let curLayerIndex = layerIndexDict[d.layerName];
    			data.colorRange = cnnLayerRanges[selectedScaleLevel][curLayerIndex];
    			data.isInputInputLayer = curLayerIndex <= 1;
    			$$invalidate(8, nodeData = data);
    		}

    		let curLayerIndex = layerIndexDict[d.layerName];

    		if (d.type == 'relu' || d.type == 'pool') {
    			$$invalidate(10, isExitedFromDetailedView = false);

    			if (!isInActPoolDetailView) {
    				// Enter the act pool detail view
    				enterDetailView(curLayerIndex, d.index);
    			} else {
    				if (d.index === actPoolDetailViewNodeIndex) {
    					// Quit the act pool detail view
    					quitActPoolDetailView();
    				} else {
    					// Switch the detail view input to the new clicked pair
    					// Remove the previous selection effect
    					svg.select(`g#layer-${curLayerIndex}-node-${actPoolDetailViewNodeIndex}`).select('rect.bounding').classed('hidden', true);

    					svg.select(`g#layer-${curLayerIndex - 1}-node-${actPoolDetailViewNodeIndex}`).select('rect.bounding').classed('hidden', true);
    					let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    					edgeGroup.selectAll(`path.edge-${curLayerIndex}-${actPoolDetailViewNodeIndex}`).transition().ease(d3.easeCubicOut).duration(200).style('stroke', edgeInitColor).style('stroke-width', edgeStrokeWidth).style('opacity', edgeOpacity);
    					let underGroup = svg.select('g.underneath');
    					underGroup.select(`#underneath-gateway-${actPoolDetailViewNodeIndex}`).style('opacity', 0);

    					// Add selection effect on the new selected pair
    					svg.select(`g#layer-${curLayerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', false);

    					svg.select(`g#layer-${curLayerIndex - 1}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', false);
    					edgeGroup.selectAll(`path.edge-${curLayerIndex}-${nodeIndex}`).raise().transition().ease(d3.easeCubicInOut).duration(400).style('stroke', edgeHoverColor).style('stroke-width', '1').style('opacity', 1);
    					underGroup.select(`#underneath-gateway-${nodeIndex}`).style('opacity', 1);
    					actPoolDetailViewNodeIndex = nodeIndex;
    				}
    			}
    		}

    		// Enter the second view (layer-view) when user clicks a conv node
    		if ((d.type === 'conv' || d.layerName === 'output') && !isInIntermediateView) {
    			prepareToEnterIntermediateView(d, g, nodeIndex, curLayerIndex);

    			if (d.layerName === 'conv_1_1') {
    				drawConv1(curLayerIndex, d, nodeIndex, width, height, intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
    			} else if (d.layerName === 'conv_1_2') {
    				drawConv2(curLayerIndex, d, nodeIndex, width, height, intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
    			} else if (d.layerName === 'conv_2_1') {
    				drawConv3(curLayerIndex, d, nodeIndex, width, height, intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
    			} else if (d.layerName === 'conv_2_2') {
    				drawConv4(curLayerIndex, d, nodeIndex, width, height, intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
    			} else if (d.layerName === 'output') {
    				drawFlatten(curLayerIndex, d, nodeIndex, width, height);
    			}
    		} else // Quit the layerview
    		if ((d.type === 'conv' || d.layerName === 'output') && isInIntermediateView) {
    			quitIntermediateView(curLayerIndex, g, i);
    		}
    	};

    	const nodeMouseOverHandler = (d, i, g) => {
    		// if (isInIntermediateView || isInActPoolDetailView) { return; }
    		if (isInIntermediateView) {
    			return;
    		}

    		// Highlight the edges
    		let layerIndex = layerIndexDict[d.layerName];

    		let nodeIndex = d.index;
    		let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    		edgeGroup.selectAll(`path.edge-${layerIndex}-${nodeIndex}`).raise().transition().ease(d3.easeCubicInOut).duration(400).style('stroke', edgeHoverColor).style('stroke-width', '1').style('opacity', 1);

    		// Highlight its border
    		d3.select(g[i]).select('rect.bounding').classed('hidden', false);

    		// Highlight source's border
    		if (d.inputLinks.length === 1) {
    			let link = d.inputLinks[0];
    			let layerIndex = layerIndexDict[link.source.layerName];
    			let nodeIndex = link.source.index;
    			svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', false);
    		} else {
    			svg.select(`g#cnn-layer-group-${layerIndex - 1}`).selectAll('g.node-group').selectAll('rect.bounding').classed('hidden', false);
    		}

    		// Highlight the output text
    		if (d.layerName === 'output') {
    			d3.select(g[i]).select('.output-text').style('opacity', 0.8).style('text-decoration', 'underline');
    		}
    	}; /* Use the following commented code if we have non-linear model
    d.inputLinks.forEach(link => {
      let layerIndex = layerIndexDict[link.source.layerName];
      let nodeIndex = link.source.index;
      svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
        .select('rect.bounding')
        .classed('hidden', false);
    });
    */

    	const nodeMouseLeaveHandler = (d, i, g) => {
    		// Screenshot
    		// return;
    		if (isInIntermediateView) {
    			return;
    		}

    		// Keep the highlight if user has clicked
    		if (isInActPoolDetailView || (d.layerName !== selectedNode.layerName || d.index !== selectedNode.index)) {
    			let layerIndex = layerIndexDict[d.layerName];
    			let nodeIndex = d.index;
    			let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    			edgeGroup.selectAll(`path.edge-${layerIndex}-${nodeIndex}`).transition().ease(d3.easeCubicOut).duration(200).style('stroke', edgeInitColor).style('stroke-width', edgeStrokeWidth).style('opacity', edgeOpacity);
    			d3.select(g[i]).select('rect.bounding').classed('hidden', true);

    			if (d.inputLinks.length === 1) {
    				let link = d.inputLinks[0];
    				let layerIndex = layerIndexDict[link.source.layerName];
    				let nodeIndex = link.source.index;
    				svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', true);
    			} else {
    				svg.select(`g#cnn-layer-group-${layerIndex - 1}`).selectAll('g.node-group').selectAll('rect.bounding').classed('hidden', d => d.layerName !== selectedNode.layerName || d.index !== selectedNode.index);
    			}

    			// Dehighlight the output text
    			if (d.layerName === 'output') {
    				d3.select(g[i]).select('.output-text').style('fill', 'black').style('opacity', 0.5).style('text-decoration', 'none');
    			}
    		} /* Use the following commented code if we have non-linear model
    d.inputLinks.forEach(link => {
      let layerIndex = layerIndexDict[link.source.layerName];
      let nodeIndex = link.source.index;
      svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
        .select('rect.bounding')
        .classed('hidden', true);
    });
    */
    	};

    	let logits = [-4.28, 2.96, -0.38, 5.24, -7.56, -3.43, 8.63, 2.63, 6.30, 0.68];
    	let selectedI = 4;

    	onMount(async () => {
    		// Create SVG
    		wholeSvg = d3.select(overviewComponent).select('#cnn-svg');

    		svg = wholeSvg.append('g').attr('class', 'main-svg').attr('transform', `translate(${svgPaddings.left}, 0)`);
    		svgStore.set(svg);
    		width = Number(wholeSvg.style('width').replace('px', '')) - svgPaddings.left - svgPaddings.right;
    		height = Number(wholeSvg.style('height').replace('px', '')) - svgPaddings.top - svgPaddings.bottom;
    		let cnnGroup = svg.append('g').attr('class', 'cnn-group');
    		let underGroup = svg.append('g').attr('class', 'underneath');
    		let svgYMid = +wholeSvg.style('height').replace('px', '') / 2;

    		detailedViewAbsCoords = {
    			1: [600, 100 + svgYMid - 220 / 2, 490, 290],
    			2: [500, 100 + svgYMid - 220 / 2, 490, 290],
    			3: [700, 100 + svgYMid - 220 / 2, 490, 290],
    			4: [600, 100 + svgYMid - 220 / 2, 490, 290],
    			5: [650, 100 + svgYMid - 220 / 2, 490, 290],
    			6: [850, 100 + svgYMid - 220 / 2, 490, 290],
    			7: [100, 100 + svgYMid - 220 / 2, 490, 290],
    			8: [60, 100 + svgYMid - 220 / 2, 490, 290],
    			9: [200, 100 + svgYMid - 220 / 2, 490, 290],
    			10: [300, 100 + svgYMid - 220 / 2, 490, 290]
    		};

    		// Define global arrow marker end
    		svg.append("defs").append("marker").attr("id", 'marker').attr("viewBox", "0 -5 10 10").attr("refX", 6).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").style('stroke-width', 1.2).style('fill', 'gray').style('stroke', 'gray').attr("d", "M0,-5L10,0L0,5");

    		// Alternative arrow head style for non-interactive annotation
    		svg.append("defs").append("marker").attr("id", 'marker-alt').attr("viewBox", "0 -5 10 10").attr("refX", 6).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").style('fill', 'none').style('stroke', 'gray').style('stroke-width', 2).attr("d", "M-5,-10L10,0L-5,10");

    		console.time('Construct cnn');
    		model = await loadTrainedModel('/assets/data/fer_tinyVGG/model.json');
    		cnn = await constructCNN(`/assets/img/${selectedImage}`, model);
    		console.timeEnd('Construct cnn');
    		cnnStore.set(cnn);

    		// Ignore the flatten layer for now
    		let flatten = cnn[cnn.length - 2];

    		cnn.splice(cnn.length - 2, 1);
    		cnn.flatten = flatten;
    		updateCNNLayerRanges();

    		// Create and draw the CNN view
    		drawCNN(width, height, cnnGroup, nodeMouseOverHandler, nodeMouseLeaveHandler, nodeClickHandler);
    	});

    	const detailedButtonClicked = () => {
    		$$invalidate(2, detailedMode = !detailedMode);
    		detailedModeStore.set(detailedMode);

    		if (!isInIntermediateView) {
    			// Show the legend
    			svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', !detailedMode);

    			svg.selectAll('.input-legend').classed('hidden', !detailedMode);
    			svg.selectAll('.output-legend').classed('hidden', !detailedMode);
    		}

    		// Switch the layer name
    		svg.selectAll('.layer-detailed-label').classed('hidden', !detailedMode);

    		svg.selectAll('.layer-label').classed('hidden', detailedMode);
    	};

    	const imageOptionClicked = async e => {
    		let newImageName = d3.select(e.target).attr('data-imageName');

    		if (newImageName !== selectedImage) {
    			$$invalidate(7, selectedImage = newImageName);

    			// Re-compute the CNN using the new input image
    			cnn = await constructCNN(`/assets/img/${selectedImage}`, model);

    			// Ignore the flatten layer for now
    			let flatten = cnn[cnn.length - 2];

    			cnn.splice(cnn.length - 2, 1);
    			cnn.flatten = flatten;
    			cnnStore.set(cnn);

    			// Update all scales used in the CNN view
    			updateCNNLayerRanges();

    			updateCNN();
    		}
    	};

    	const customImageClicked = () => {
    		// Case 1: there is no custom image -> show the modal to get user input
    		if (customImageURL === null) {
    			modalInfo.show = true;
    			modalInfo.preImage = selectedImage;
    			modalStore.set(modalInfo);
    		} else // Case 2: there is an existing custom image, not the focus -> switch to this image
    		if (selectedImage !== 'custom') {
    			let fakeEvent = { detail: { url: customImageURL } };
    			handleCustomImage(fakeEvent);
    		} else // Case 3: there is an existing custom image, and its the focus -> let user
    		// upload a new image
    		{
    			modalInfo.show = true;
    			modalInfo.preImage = selectedImage;
    			modalStore.set(modalInfo);
    		}

    		if (selectedImage !== 'custom') {
    			$$invalidate(7, selectedImage = 'custom');
    		}
    	};

    	const handleModalCanceled = event => {
    		// User cancels the modal without a successful image, so we restore the
    		// previous selected image as input
    		$$invalidate(7, selectedImage = event.detail.preImage);
    	};

    	const handleCustomImage = async event => {
    		// User gives a valid image URL
    		$$invalidate(12, customImageURL = event.detail.url);

    		// Re-compute the CNN using the new input image
    		cnn = await constructCNN(customImageURL, model);

    		// Ignore the flatten layer for now
    		let flatten = cnn[cnn.length - 2];

    		cnn.splice(cnn.length - 2, 1);
    		cnn.flatten = flatten;
    		cnnStore.set(cnn);

    		// Update the UI
    		let customImageSlot = d3.select(overviewComponent).select('.custom-image').node();

    		drawCustomImage(customImageSlot, cnn[0]);

    		// Update all scales used in the CNN view
    		updateCNNLayerRanges();

    		updateCNN();
    	};

    	function handleExitFromDetiledConvView(event) {
    		if (event.detail.text) {
    			detailedViewNum = undefined;
    			svg.select(`rect#underneath-gateway-${selectedNodeIndex}`).style('opacity', 0);
    			$$invalidate(9, selectedNodeIndex = -1);
    		}
    	}

    	function handleExitFromDetiledPoolView(event) {
    		if (event.detail.text) {
    			quitActPoolDetailView();
    			$$invalidate(10, isExitedFromDetailedView = true);
    		}
    	}

    	function handleExitFromDetiledActivationView(event) {
    		if (event.detail.text) {
    			quitActPoolDetailView();
    			$$invalidate(10, isExitedFromDetailedView = true);
    		}
    	}

    	function handleExitFromDetiledSoftmaxView(event) {
    		$$invalidate(3, softmaxDetailViewInfo.show = false, softmaxDetailViewInfo);
    		softmaxDetailViewStore.set(softmaxDetailViewInfo);
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<Cnn> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		selectedScaleLevel = select_value(this);
    		$$invalidate(0, selectedScaleLevel);
    	}

    	function div6_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			overviewComponent = $$value;
    			$$invalidate(1, overviewComponent);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		cnnStore,
    		svgStore,
    		vSpaceAroundGapStore,
    		hSpaceAroundGapStore,
    		nodeCoordinateStore,
    		selectedScaleLevelStore,
    		cnnLayerRangesStore,
    		needRedrawStore,
    		cnnLayerMinMaxStore,
    		detailedModeStore,
    		shouldIntermediateAnimateStore,
    		isInSoftmaxStore,
    		softmaxDetailViewStore,
    		hoverInfoStore,
    		allowsSoftmaxAnimationStore,
    		modalStore,
    		intermediateLayerPositionStore,
    		leftStartStore,
    		ConvolutionView: Convolutionview,
    		ActivationView: Activationview,
    		PoolView: Poolview,
    		SoftmaxView: Softmaxview,
    		Modal,
    		Article,
    		loadTrainedModel,
    		constructCNN,
    		overviewConfig,
    		addOverlayRect,
    		drawConv1,
    		drawConv2,
    		drawConv3,
    		drawConv4,
    		moveLayerX,
    		addOverlayGradient,
    		drawFlatten,
    		softmaxDetailViewMouseOverHandler,
    		softmaxDetailViewMouseLeaveHandler,
    		drawOutput,
    		drawCNN,
    		updateCNN,
    		updateCNNLayerRanges,
    		drawCustomImage,
    		afficheStart,
    		overviewComponent,
    		scaleLevelSet,
    		selectedScaleLevel,
    		previousSelectedScaleLevel,
    		wholeSvg,
    		svg,
    		layerColorScales,
    		nodeLength,
    		plusSymbolRadius,
    		numLayers,
    		edgeOpacity,
    		edgeInitColor,
    		edgeHoverColor,
    		edgeHoverOuting,
    		edgeStrokeWidth,
    		intermediateColor,
    		kernelRectLength,
    		svgPaddings,
    		gapRatio,
    		overlayRectOffset,
    		classLists,
    		needRedraw,
    		nodeCoordinate,
    		cnnLayerRanges,
    		cnnLayerMinMax,
    		detailedMode,
    		shouldIntermediateAnimate,
    		vSpaceAroundGap,
    		hSpaceAroundGap,
    		isInSoftmax,
    		softmaxDetailViewInfo,
    		modalInfo,
    		hoverInfo,
    		intermediateLayerPosition,
    		width,
    		height,
    		model,
    		selectedNode,
    		isInIntermediateView,
    		isInActPoolDetailView,
    		actPoolDetailViewNodeIndex,
    		actPoolDetailViewLayerIndex,
    		detailedViewNum,
    		disableControl,
    		cnn,
    		detailedViewAbsCoords,
    		layerIndexDict,
    		layerLegendDict,
    		imageOptions,
    		selectedImage,
    		nodeData,
    		selectedNodeIndex,
    		isExitedFromDetailedView,
    		isExitedFromCollapse,
    		customImageURL,
    		selectedScaleLevelChanged,
    		intermediateNodeMouseOverHandler,
    		intermediateNodeMouseLeaveHandler,
    		intermediateNodeClicked,
    		emptySpaceClicked,
    		prepareToEnterIntermediateView,
    		quitActPoolDetailView,
    		actPoolDetailViewPreNodeMouseOverHandler,
    		actPoolDetailViewPreNodeMouseLeaveHandler,
    		actPoolDetailViewPreNodeClickHandler,
    		enterDetailView,
    		quitIntermediateView,
    		nodeClickHandler,
    		nodeMouseOverHandler,
    		nodeMouseLeaveHandler,
    		logits,
    		selectedI,
    		detailedButtonClicked,
    		imageOptionClicked,
    		customImageClicked,
    		handleModalCanceled,
    		handleCustomImage,
    		handleExitFromDetiledConvView,
    		handleExitFromDetiledPoolView,
    		handleExitFromDetiledActivationView,
    		handleExitFromDetiledSoftmaxView
    	});

    	$$self.$inject_state = $$props => {
    		if ('overviewComponent' in $$props) $$invalidate(1, overviewComponent = $$props.overviewComponent);
    		if ('scaleLevelSet' in $$props) scaleLevelSet = $$props.scaleLevelSet;
    		if ('selectedScaleLevel' in $$props) $$invalidate(0, selectedScaleLevel = $$props.selectedScaleLevel);
    		if ('previousSelectedScaleLevel' in $$props) previousSelectedScaleLevel = $$props.previousSelectedScaleLevel;
    		if ('wholeSvg' in $$props) wholeSvg = $$props.wholeSvg;
    		if ('svg' in $$props) svg = $$props.svg;
    		if ('needRedraw' in $$props) needRedraw = $$props.needRedraw;
    		if ('nodeCoordinate' in $$props) nodeCoordinate = $$props.nodeCoordinate;
    		if ('cnnLayerRanges' in $$props) cnnLayerRanges = $$props.cnnLayerRanges;
    		if ('cnnLayerMinMax' in $$props) cnnLayerMinMax = $$props.cnnLayerMinMax;
    		if ('detailedMode' in $$props) $$invalidate(2, detailedMode = $$props.detailedMode);
    		if ('shouldIntermediateAnimate' in $$props) shouldIntermediateAnimate = $$props.shouldIntermediateAnimate;
    		if ('vSpaceAroundGap' in $$props) vSpaceAroundGap = $$props.vSpaceAroundGap;
    		if ('hSpaceAroundGap' in $$props) hSpaceAroundGap = $$props.hSpaceAroundGap;
    		if ('isInSoftmax' in $$props) isInSoftmax = $$props.isInSoftmax;
    		if ('softmaxDetailViewInfo' in $$props) $$invalidate(3, softmaxDetailViewInfo = $$props.softmaxDetailViewInfo);
    		if ('modalInfo' in $$props) modalInfo = $$props.modalInfo;
    		if ('hoverInfo' in $$props) $$invalidate(4, hoverInfo = $$props.hoverInfo);
    		if ('intermediateLayerPosition' in $$props) intermediateLayerPosition = $$props.intermediateLayerPosition;
    		if ('width' in $$props) width = $$props.width;
    		if ('height' in $$props) height = $$props.height;
    		if ('model' in $$props) model = $$props.model;
    		if ('selectedNode' in $$props) $$invalidate(5, selectedNode = $$props.selectedNode);
    		if ('isInIntermediateView' in $$props) isInIntermediateView = $$props.isInIntermediateView;
    		if ('isInActPoolDetailView' in $$props) isInActPoolDetailView = $$props.isInActPoolDetailView;
    		if ('actPoolDetailViewNodeIndex' in $$props) actPoolDetailViewNodeIndex = $$props.actPoolDetailViewNodeIndex;
    		if ('actPoolDetailViewLayerIndex' in $$props) actPoolDetailViewLayerIndex = $$props.actPoolDetailViewLayerIndex;
    		if ('detailedViewNum' in $$props) detailedViewNum = $$props.detailedViewNum;
    		if ('disableControl' in $$props) $$invalidate(6, disableControl = $$props.disableControl);
    		if ('cnn' in $$props) cnn = $$props.cnn;
    		if ('detailedViewAbsCoords' in $$props) detailedViewAbsCoords = $$props.detailedViewAbsCoords;
    		if ('imageOptions' in $$props) $$invalidate(15, imageOptions = $$props.imageOptions);
    		if ('selectedImage' in $$props) $$invalidate(7, selectedImage = $$props.selectedImage);
    		if ('nodeData' in $$props) $$invalidate(8, nodeData = $$props.nodeData);
    		if ('selectedNodeIndex' in $$props) $$invalidate(9, selectedNodeIndex = $$props.selectedNodeIndex);
    		if ('isExitedFromDetailedView' in $$props) $$invalidate(10, isExitedFromDetailedView = $$props.isExitedFromDetailedView);
    		if ('isExitedFromCollapse' in $$props) $$invalidate(11, isExitedFromCollapse = $$props.isExitedFromCollapse);
    		if ('customImageURL' in $$props) $$invalidate(12, customImageURL = $$props.customImageURL);
    		if ('logits' in $$props) logits = $$props.logits;
    		if ('selectedI' in $$props) selectedI = $$props.selectedI;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*selectedScaleLevel*/ 1) {
    			 (selectedScaleLevelChanged());
    		}
    	};

    	return [
    		selectedScaleLevel,
    		overviewComponent,
    		detailedMode,
    		softmaxDetailViewInfo,
    		hoverInfo,
    		selectedNode,
    		disableControl,
    		selectedImage,
    		nodeData,
    		selectedNodeIndex,
    		isExitedFromDetailedView,
    		isExitedFromCollapse,
    		customImageURL,
    		afficheStart,
    		layerColorScales,
    		imageOptions,
    		detailedButtonClicked,
    		imageOptionClicked,
    		customImageClicked,
    		handleModalCanceled,
    		handleCustomImage,
    		handleExitFromDetiledConvView,
    		handleExitFromDetiledPoolView,
    		handleExitFromDetiledActivationView,
    		handleExitFromDetiledSoftmaxView,
    		select_change_handler,
    		div6_binding
    	];
    }

    class Cnn extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {}, null, [-1, -1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cnn",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* src\overview\Presentation.svelte generated by Svelte v3.47.0 */
    const file$c = "src\\overview\\Presentation.svelte";

    function create_fragment$c(ctx) {
    	let div12;
    	let div11;
    	let div10;
    	let div6;
    	let div4;
    	let div2;
    	let article0;
    	let h2;
    	let t1;
    	let div0;
    	let button0;
    	let span0;
    	let i0;
    	let t2;
    	let span1;
    	let t4;
    	let article1;
    	let p0;
    	let t6;
    	let p1;
    	let t8;
    	let div1;
    	let button1;
    	let span2;
    	let i1;
    	let t9;
    	let span3;
    	let t11;
    	let div3;
    	let article2;
    	let p2;
    	let t13;
    	let p3;
    	let t15;
    	let figure;
    	let img;
    	let img_src_value;
    	let t16;
    	let div5;
    	let article3;
    	let p4;
    	let t18;
    	let p5;
    	let t20;
    	let div9;
    	let article4;
    	let div8;
    	let p6;
    	let t22;
    	let div7;
    	let p7;
    	let t24;
    	let p8;
    	let t26;
    	let p9;
    	let t28;
    	let button2;
    	let span4;
    	let i2;
    	let t29;
    	let span5;
    	let mounted;
    	let dispose;
    	add_render_callback(/*onwindowresize*/ ctx[4]);

    	const block = {
    		c: function create() {
    			div12 = element("div");
    			div11 = element("div");
    			div10 = element("div");
    			div6 = element("div");
    			div4 = element("div");
    			div2 = element("div");
    			article0 = element("article");
    			h2 = element("h2");
    			h2.textContent = "Obtenir son profil d'apprenant";
    			t1 = space();
    			div0 = element("div");
    			button0 = element("button");
    			span0 = element("span");
    			i0 = element("i");
    			t2 = space();
    			span1 = element("span");
    			span1.textContent = "Faire le test";
    			t4 = space();
    			article1 = element("article");
    			p0 = element("p");
    			p0.textContent = "DataTrainX";
    			t6 = space();
    			p1 = element("p");
    			p1.textContent = "A travers la saisie d’un questionnaire (Kolb) nous cherchons à déterminer un profil d’apprenant dans le projet DataTrainx. L’utilisateur sera enregistré en vidéo et une comparaison sera effectuée avec les émotions que vous aurez exprimées.";
    			t8 = space();
    			div1 = element("div");
    			button1 = element("button");
    			span2 = element("span");
    			i1 = element("i");
    			t9 = space();
    			span3 = element("span");
    			span3.textContent = "En savoir plus";
    			t11 = space();
    			div3 = element("div");
    			article2 = element("article");
    			p2 = element("p");
    			p2.textContent = "Capture vidéo";
    			t13 = space();
    			p3 = element("p");
    			p3.textContent = "Prêt à capturer vos émotions ?";
    			t15 = space();
    			figure = element("figure");
    			img = element("img");
    			t16 = space();
    			div5 = element("div");
    			article3 = element("article");
    			p4 = element("p");
    			p4.textContent = "Protection de votre image";
    			t18 = space();
    			p5 = element("p");
    			p5.textContent = "Des données collectés uniquement à des fins de recherche en partenaria avec l'IPST CNAM de l'université de Toulouse. DataTrainX est un projet d'étude personnel dans le cadre de mon mémoire d'ingénieur. Les données sont collectés sur mon propre serveur, il n'y a aucun autre intermédiaire et les données transitent de manière cryptée!";
    			t20 = space();
    			div9 = element("div");
    			article4 = element("article");
    			div8 = element("div");
    			p6 = element("p");
    			p6.textContent = "Réseau neuronal convolutif";
    			t22 = space();
    			div7 = element("div");
    			p7 = element("p");
    			p7.textContent = "En apprentissage automatique, un réseau de neurones convolutifs, appellé aussi CNN, est un type de réseau de neurones artificiels, dans lequel le motif de connexion entre les neurones est inspiré par le cortex visuel des animaux. Les neurones de cette région du cerveau sont arrangés de sorte qu'ils correspondent à des régions qui se chevauchent lors du pavage du champ visuel.";
    			t24 = space();
    			p8 = element("p");
    			p8.textContent = "Leur fonctionnement est inspiré par les processus biologiques, ils consistent en un empilage multicouche de perceptrons, dont le but est de prétraiter de petites quantités d'informations.";
    			t26 = space();
    			p9 = element("p");
    			p9.textContent = "Les réseaux neuronaux convolutifs ont de larges applications dans la reconnaissance d'image et vidéo, les systèmes de recommandation et le traitement du langage naturel.";
    			t28 = space();
    			button2 = element("button");
    			span4 = element("span");
    			i2 = element("i");
    			t29 = space();
    			span5 = element("span");
    			span5.textContent = "Comment ça marche ?";
    			attr_dev(h2, "class", "svelte-gh4brt");
    			add_location(h2, file$c, 51, 26, 1341);
    			attr_dev(i0, "class", "fa-solid fa-address-card");
    			add_location(i0, file$c, 55, 34, 1664);
    			attr_dev(span0, "class", "icon");
    			add_location(span0, file$c, 54, 32, 1609);
    			add_location(span1, file$c, 57, 34, 1781);
    			attr_dev(button0, "class", "button are-medium center is-link is-rounded");
    			add_location(button0, file$c, 53, 30, 1472);
    			attr_dev(div0, "class", "buttons are-medium");
    			add_location(div0, file$c, 52, 26, 1408);
    			attr_dev(article0, "class", "tile is-child notification is-primary svelte-gh4brt");
    			add_location(article0, file$c, 50, 22, 1258);
    			attr_dev(p0, "class", "title logo-text");
    			add_location(p0, file$c, 62, 26, 2023);
    			add_location(p1, file$c, 63, 26, 2092);
    			attr_dev(i1, "class", "fa-solid fa-circle-info");
    			add_location(i1, file$c, 67, 36, 2637);
    			attr_dev(span2, "class", "icon");
    			add_location(span2, file$c, 66, 32, 2580);
    			add_location(span3, file$c, 69, 34, 2753);
    			attr_dev(button1, "class", "button are-medium right is-warning is-light");
    			add_location(button1, file$c, 65, 30, 2419);
    			attr_dev(div1, "class", "buttons");
    			add_location(div1, file$c, 64, 26, 2366);
    			attr_dev(article1, "class", "tile is-child notification is-warning svelte-gh4brt");
    			add_location(article1, file$c, 61, 22, 1940);
    			attr_dev(div2, "class", "tile is-parent is-vertical");
    			add_location(div2, file$c, 49, 18, 1194);
    			attr_dev(p2, "class", "title");
    			add_location(p2, file$c, 76, 26, 3067);
    			attr_dev(p3, "class", "subtitle");
    			add_location(p3, file$c, 77, 26, 3129);
    			if (!src_url_equal(img.src, img_src_value = "https://bulma.io/images/placeholders/640x480.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$c, 79, 30, 3273);
    			attr_dev(figure, "class", "image is-4by3");
    			add_location(figure, file$c, 78, 26, 3211);
    			attr_dev(article2, "class", "tile is-child notification is-info svelte-gh4brt");
    			add_location(article2, file$c, 75, 22, 2987);
    			attr_dev(div3, "class", "tile is-parent");
    			add_location(div3, file$c, 74, 18, 2935);
    			attr_dev(div4, "class", "tile");
    			add_location(div4, file$c, 48, 14, 1156);
    			attr_dev(p4, "class", "title");
    			add_location(p4, file$c, 86, 22, 3594);
    			attr_dev(p5, "class", "");
    			add_location(p5, file$c, 87, 22, 3664);
    			attr_dev(article3, "class", "tile is-child notification is-danger svelte-gh4brt");
    			add_location(article3, file$c, 85, 18, 3516);
    			attr_dev(div5, "class", "tile is-parent");
    			add_location(div5, file$c, 84, 14, 3468);
    			attr_dev(div6, "class", "tile is-vertical is-8");
    			add_location(div6, file$c, 47, 10, 1105);
    			attr_dev(p6, "class", "title");
    			add_location(p6, file$c, 94, 22, 4259);
    			add_location(p7, file$c, 96, 26, 4379);
    			add_location(p8, file$c, 97, 26, 4792);
    			add_location(p9, file$c, 98, 26, 5014);
    			attr_dev(i2, "class", "fas fa-eye");
    			add_location(i2, file$c, 101, 30, 5396);
    			attr_dev(span4, "class", "icon");
    			add_location(span4, file$c, 100, 28, 5345);
    			add_location(span5, file$c, 103, 30, 5491);
    			attr_dev(button2, "class", "button is-primary");
    			attr_dev(button2, "id", "explain-button");
    			add_location(button2, file$c, 99, 26, 5218);
    			attr_dev(div7, "class", "content");
    			add_location(div7, file$c, 95, 22, 4330);
    			attr_dev(div8, "class", "content");
    			add_location(div8, file$c, 93, 18, 4214);
    			attr_dev(article4, "class", "tile is-child notification is-success svelte-gh4brt");
    			add_location(article4, file$c, 92, 14, 4139);
    			attr_dev(div9, "class", "tile is-parent");
    			add_location(div9, file$c, 91, 10, 4095);
    			attr_dev(div10, "class", "tile is-ancestor svelte-gh4brt");
    			set_style(div10, "height", /*innerHeight*/ ctx[1] - /*top*/ ctx[3] + "px");
    			add_location(div10, file$c, 46, 6, 1023);
    			attr_dev(div11, "class", "container");
    			add_location(div11, file$c, 45, 2, 992);
    			attr_dev(div12, "id", "home");
    			attr_dev(div12, "class", "start jumbotron text-center svelte-gh4brt");
    			set_style(div12, "height", /*innerHeight*/ ctx[1] - /*top*/ ctx[3] + "px");
    			set_style(div12, "left", /*leftStartValue*/ ctx[2] + "px");
    			add_location(div12, file$c, 44, 0, 873);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div12, anchor);
    			append_dev(div12, div11);
    			append_dev(div11, div10);
    			append_dev(div10, div6);
    			append_dev(div6, div4);
    			append_dev(div4, div2);
    			append_dev(div2, article0);
    			append_dev(article0, h2);
    			append_dev(article0, t1);
    			append_dev(article0, div0);
    			append_dev(div0, button0);
    			append_dev(button0, span0);
    			append_dev(span0, i0);
    			append_dev(button0, t2);
    			append_dev(button0, span1);
    			append_dev(div2, t4);
    			append_dev(div2, article1);
    			append_dev(article1, p0);
    			append_dev(article1, t6);
    			append_dev(article1, p1);
    			append_dev(article1, t8);
    			append_dev(article1, div1);
    			append_dev(div1, button1);
    			append_dev(button1, span2);
    			append_dev(span2, i1);
    			append_dev(button1, t9);
    			append_dev(button1, span3);
    			append_dev(div4, t11);
    			append_dev(div4, div3);
    			append_dev(div3, article2);
    			append_dev(article2, p2);
    			append_dev(article2, t13);
    			append_dev(article2, p3);
    			append_dev(article2, t15);
    			append_dev(article2, figure);
    			append_dev(figure, img);
    			append_dev(div6, t16);
    			append_dev(div6, div5);
    			append_dev(div5, article3);
    			append_dev(article3, p4);
    			append_dev(article3, t18);
    			append_dev(article3, p5);
    			append_dev(div10, t20);
    			append_dev(div10, div9);
    			append_dev(div9, article4);
    			append_dev(article4, div8);
    			append_dev(div8, p6);
    			append_dev(div8, t22);
    			append_dev(div8, div7);
    			append_dev(div7, p7);
    			append_dev(div7, t24);
    			append_dev(div7, p8);
    			append_dev(div7, t26);
    			append_dev(div7, p9);
    			append_dev(div7, t28);
    			append_dev(div7, button2);
    			append_dev(button2, span4);
    			append_dev(span4, i2);
    			append_dev(button2, t29);
    			append_dev(button2, span5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "resize", /*onwindowresize*/ ctx[4]),
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(leftStartStore.set(-/*innerWidth*/ ctx[0]))) leftStartStore.set(-/*innerWidth*/ ctx[0]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(button1, "click", /*click_handler*/ ctx[5], false, false, false),
    					listen_dev(
    						button2,
    						"click",
    						function () {
    							if (is_function(leftStartStore.set(-/*innerWidth*/ ctx[0]))) leftStartStore.set(-/*innerWidth*/ ctx[0]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (dirty & /*innerHeight*/ 2) {
    				set_style(div10, "height", /*innerHeight*/ ctx[1] - /*top*/ ctx[3] + "px");
    			}

    			if (dirty & /*innerHeight*/ 2) {
    				set_style(div12, "height", /*innerHeight*/ ctx[1] - /*top*/ ctx[3] + "px");
    			}

    			if (dirty & /*leftStartValue*/ 4) {
    				set_style(div12, "left", /*leftStartValue*/ ctx[2] + "px");
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div12);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Presentation', slots, []);
    	let innerWidth;
    	let innerHeight;
    	let clientHeight;
    	let top = 50;
    	let leftStartValue;

    	leftStartStore.subscribe(value => {
    		$$invalidate(2, leftStartValue = value);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Presentation> was created with unknown prop '${key}'`);
    	});

    	function onwindowresize() {
    		$$invalidate(1, innerHeight = window.innerHeight);
    		$$invalidate(0, innerWidth = window.innerWidth);
    	}

    	const click_handler = () => scrollTo({ element: "#description" });

    	$$self.$capture_state = () => ({
    		animateScroll,
    		leftStartStore,
    		innerWidth,
    		innerHeight,
    		clientHeight,
    		top,
    		leftStartValue
    	});

    	$$self.$inject_state = $$props => {
    		if ('innerWidth' in $$props) $$invalidate(0, innerWidth = $$props.innerWidth);
    		if ('innerHeight' in $$props) $$invalidate(1, innerHeight = $$props.innerHeight);
    		if ('clientHeight' in $$props) clientHeight = $$props.clientHeight;
    		if ('top' in $$props) $$invalidate(3, top = $$props.top);
    		if ('leftStartValue' in $$props) $$invalidate(2, leftStartValue = $$props.leftStartValue);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [innerWidth, innerHeight, leftStartValue, top, onwindowresize, click_handler];
    }

    class Presentation extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Presentation",
    			options,
    			id: create_fragment$c.name
    		});
    	}
    }

    /* src\Datatrainx.svelte generated by Svelte v3.47.0 */
    const file$d = "src\\Datatrainx.svelte";

    function create_fragment$d(ctx) {
    	let main;
    	let section0;
    	let start;
    	let t0;
    	let section1;
    	let cnn;
    	let t1;
    	let section2;
    	let article;
    	let current;
    	start = new Presentation({ $$inline: true });
    	cnn = new Cnn({ $$inline: true });
    	article = new Article({ $$inline: true });

    	const block = {
    		c: function create() {
    			main = element("main");
    			section0 = element("section");
    			create_component(start.$$.fragment);
    			t0 = space();
    			section1 = element("section");
    			create_component(cnn.$$.fragment);
    			t1 = space();
    			section2 = element("section");
    			create_component(article.$$.fragment);
    			attr_dev(section0, "id", "start");
    			add_location(section0, file$d, 33, 4, 700);
    			attr_dev(section1, "id", "cnn");
    			attr_dev(section1, "class", "svelte-1nuj68o");
    			add_location(section1, file$d, 36, 4, 757);
    			attr_dev(section2, "id", "description");
    			add_location(section2, file$d, 39, 4, 810);
    			add_location(main, file$d, 32, 0, 689);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, section0);
    			mount_component(start, section0, null);
    			append_dev(main, t0);
    			append_dev(main, section1);
    			mount_component(cnn, section1, null);
    			append_dev(main, t1);
    			append_dev(main, section2);
    			mount_component(article, section2, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(start.$$.fragment, local);
    			transition_in(cnn.$$.fragment, local);
    			transition_in(article.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(start.$$.fragment, local);
    			transition_out(cnn.$$.fragment, local);
    			transition_out(article.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(start);
    			destroy_component(cnn);
    			destroy_component(article);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Datatrainx', slots, []);

    	const View = {
    		OVERVIEW: 'overview',
    		LAYERVIEW: 'layerview',
    		DETAILVIEW: 'detailview'
    	};

    	let mainView = View.OVERVIEW;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Datatrainx> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Cnn,
    		cnnStore,
    		Start: Presentation,
    		Article,
    		View,
    		mainView
    	});

    	$$self.$inject_state = $$props => {
    		if ('mainView' in $$props) mainView = $$props.mainView;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [];
    }

    class Datatrainx extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Datatrainx",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* src\Header.svelte generated by Svelte v3.47.0 */

    const file$e = "src\\Header.svelte";

    function create_fragment$e(ctx) {
    	let header;
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div4;
    	let div3;
    	let a;
    	let i;

    	const block = {
    		c: function create() {
    			header = element("header");
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "DataTrainX";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "Outil de recherche des singularités cognitives d’un étudiant!";
    			t3 = space();
    			div4 = element("div");
    			div3 = element("div");
    			a = element("a");
    			i = element("i");
    			attr_dev(div0, "id", "logo-text");
    			add_location(div0, file$e, 8, 8, 72);
    			attr_dev(div1, "id", "svg-logo-tagline");
    			add_location(div1, file$e, 11, 8, 139);
    			attr_dev(div2, "id", "logo");
    			add_location(div2, file$e, 7, 4, 48);
    			attr_dev(i, "class", "fa-brands fa-github");
    			add_location(i, file$e, 19, 16, 443);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "href", "https://github.com/davy-blavette/DatatrainX");
    			add_location(a, file$e, 18, 12, 356);
    			attr_dev(div3, "class", "icon");
    			attr_dev(div3, "title", "Open-source code");
    			add_location(div3, file$e, 17, 8, 300);
    			attr_dev(div4, "class", "icons");
    			add_location(div4, file$e, 16, 4, 272);
    			attr_dev(header, "id", "header");
    			add_location(header, file$e, 5, 0, 22);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(header, t3);
    			append_dev(header, div4);
    			append_dev(div4, div3);
    			append_dev(div3, a);
    			append_dev(a, i);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$e.name
    		});
    	}
    }

    /* src\Footer.svelte generated by Svelte v3.47.0 */

    const file$f = "src\\Footer.svelte";

    function create_fragment$f(ctx) {
    	let footer;
    	let div1;
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let a0;
    	let t4;
    	let a1;
    	let t6;
    	let a2;
    	let t8;
    	let t9;
    	let div0;
    	let a3;
    	let i;

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			div1 = element("div");
    			span = element("span");
    			span.textContent = "DataTrainX";
    			t1 = space();
    			p = element("p");
    			t2 = text("By ");
    			a0 = element("a");
    			a0.textContent = "Davy Blavette";
    			t4 = text(". The source code is licensed\r\n            ");
    			a1 = element("a");
    			a1.textContent = "MIT";
    			t6 = text(". The website content\r\n            is licensed ");
    			a2 = element("a");
    			a2.textContent = "CC BY NC SA 4.0";
    			t8 = text(".");
    			t9 = space();
    			div0 = element("div");
    			a3 = element("a");
    			i = element("i");
    			attr_dev(span, "class", "logo-text svelte-1301xvb");
    			add_location(span, file$f, 36, 8, 666);
    			attr_dev(a0, "href", "https://jgthms.com");
    			attr_dev(a0, "class", "svelte-1301xvb");
    			add_location(a0, file$f, 38, 15, 737);
    			attr_dev(a1, "href", "http://opensource.org/licenses/mit-license.php");
    			attr_dev(a1, "class", "svelte-1301xvb");
    			add_location(a1, file$f, 39, 12, 826);
    			attr_dev(a2, "href", "http://creativecommons.org/licenses/by-nc-sa/4.0/");
    			attr_dev(a2, "class", "svelte-1301xvb");
    			add_location(a2, file$f, 40, 24, 937);
    			add_location(p, file$f, 37, 8, 717);
    			attr_dev(i, "class", "fa-brands fa-github");
    			add_location(i, file$f, 42, 121, 1154);
    			attr_dev(a3, "target", "_blank");
    			attr_dev(a3, "href", "https://github.com/davy-blavette/DatatrainX");
    			attr_dev(a3, "class", "svelte-1301xvb");
    			add_location(a3, file$f, 42, 51, 1084);
    			attr_dev(div0, "class", "icon svelte-1301xvb");
    			attr_dev(div0, "title", "Open-source code");
    			add_location(div0, file$f, 42, 8, 1041);
    			attr_dev(div1, "class", "content has-text-centered");
    			add_location(div1, file$f, 35, 4, 617);
    			attr_dev(footer, "class", "footer svelte-1301xvb");
    			add_location(footer, file$f, 34, 0, 588);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			append_dev(footer, div1);
    			append_dev(div1, span);
    			append_dev(div1, t1);
    			append_dev(div1, p);
    			append_dev(p, t2);
    			append_dev(p, a0);
    			append_dev(p, t4);
    			append_dev(p, a1);
    			append_dev(p, t6);
    			append_dev(p, a2);
    			append_dev(p, t8);
    			append_dev(div1, t9);
    			append_dev(div1, div0);
    			append_dev(div0, a3);
    			append_dev(a3, i);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$f.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.47.0 */

    function create_fragment$g(ctx) {
    	let header;
    	let t0;
    	let datatrainx;
    	let t1;
    	let footer;
    	let current;
    	header = new Header({ $$inline: true });
    	datatrainx = new Datatrainx({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    			t0 = space();
    			create_component(datatrainx.$$.fragment);
    			t1 = space();
    			create_component(footer.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(datatrainx, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(datatrainx.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(datatrainx.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(datatrainx, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Datatrainx, Header, Footer });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$g.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
