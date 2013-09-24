define(['backbone', 'underscore', 'channels', 'mixin'], function (Backbone, _, channels, mixin) {

    var BaseView = Backbone.View.extend({
        options : {
            name : 'BaseView',
            bindings: [
                // Example: [objectToListenTo, stringEventName, callbackFunction]
                //          ['model', 'change:something', callbackFunction]
            ]
        },
        defaultBindings: [],
        initialize : initialize,
        start : start,
        render : render,
        dataToJSON : dataToJSON,
        bindEventListener: bindEventListeners
        // Dynamically created, so the cache is not shared on the prototype:
        // elementCache: elementCache
    });

    function initialize () {
        var ModelType = this.options.ModelType || Backbone.Model;
        this.elementCache = _.memoize(elementCache);
        if (this.options.templateHtml) {
            this.template = _.template(this.options.templateHtml);
        }
        if (this.options.modelData) {
            this.model = new ModelType(this.options.modelData);
        }
        if (this.options.bindings) {
            bindEventListeners.call(this, this.options.bindings);
        }
    }

    function start () {
        var $deferred = new $.Deferred();


        $
            .when(_runLifeCycleMethod.call(this, this.beforeRender, 'BeforeRender'))
            .then(
                _lifeCycleMethodReference.call(this, this.render, 'Render'),
                _rejectStart.call(this, $deferred))
            .then(
                _lifeCycleMethodReference.call(this, this.afterRender, 'AfterRender'),
                _rejectStart.call(this, $deferred))
            .then(
                _resolveStart.call(this, $deferred),
                _rejectStart.call(this, $deferred));

        return $deferred.promise();
    }

    function render () {
        if (this.$el && this.template) {
            this.$el.html(this.template(this.dataToJSON()));
        }
    }

    function elementCache(selector) {
        return this.$el.find(selector);
    }

    function dataToJSON () {
        return this.model ? this.model.toJSON() : {};
    }
    
    /**
     * bindEventListeners
     * Bind all event listerns specified in 'defaultListeners' and 'options.listeners' using 'listenTo'
     * 
     * @param (Array[Array]) listenerArray - A collection of arrays of arguments that will be used with 'Backbone.Events.listenTo'
     * 
     * @example:
     *      bindEventListeners([[myModel, 'change:something', myCallbackFunction]]);
     * 
     * @remarks 
     * Passing in an array with a string as the first parameter will attempt to bind to this[firstArgument] so that
     * it is possible to listen to view properties that have not yet been instantiated (i.e. viewModels)
     */
    function bindEventListeners (listenerArray) {
        var self = this,
            listenerArgs = [];
        
        this.stopListening();
        
        listenerArgs = _.map(listenerArray.concat(this.defaultBindings), function (argsArray) {
            if (_.isString(argsArray[0])) {
                argsArray[0] = this[argsArray[0]];
            }
            
            return argsArray;
        });
        
        listnerArray = _.uniq(listenerArgs, function (a, b) {
            return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
        });
        
        _.each(listenerArray, function (listenerArgs) {
            self.listenTo.apply(self, listenerArgs);
        });
    }

    // Share channels among all Views
    BaseView.prototype.channels = channels;

    // --------------------------
    // Private Methods

    /**
     * Life cycle methods have an event triggered before the run.
     * If a life cycle method has one or more arguments, then the first argument passed in is its deferred.
     * The life cycle method will automatically return this deferred, otherwise it will pass through whatever
     * the method itself returns.
     *
     * @param lifeCycleMethod
     * @param lifeCycleMethodName
     * @returns {*}
     * @private
     */
    function _runLifeCycleMethod (lifeCycleMethod, lifeCycleMethodName) {
        if (!lifeCycleMethod) {
            return undefined;
        }

        return mixin({}, lifeCycleMethod)({
            async : lifeCycleMethod.length,
            preEvent : {
                name : this.options.name + ':on' + lifeCycleMethodName,
                channel : this.channels.views
            }
        }).call(this);
    }

    /**
     * A convenience wrapper for creating life cycle method references.
     * @param lifeCycleMethod
     * @param lifeCycleMethodName
     * @returns {*}
     * @private
     */
    function _lifeCycleMethodReference (lifeCycleMethod, lifeCycleMethodName) {
        return function () {
            return _runLifeCycleMethod.call(this, lifeCycleMethod, lifeCycleMethodName);
        }.bind(this);
    }

    function _resolveStart ($deferred) {
        return function () {
            $deferred.resolve();
        }.bind(this);
    }

    function _rejectStart ($deferred) {
        return function () {
            $deferred.reject();
        }.bind(this);
    }

    return BaseView;
});