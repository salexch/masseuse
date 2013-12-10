/*global define:false */
define(['jquery', 'underscore', '../utilities/configureMethod', '../utilities/enclose'],
    function ($, _, configureMethod, enclose) {
    'use strict';

        // TODO: create constants module
        var BEFORE_RENDER_DONE = 'beforeRenderDone',
            RENDER_DONE = 'renderDone',
            AFTER_RENDER_DONE = 'afterRenderDone';

    return {
        runAllMethods : runAllMethods
    }

    function runAllMethods ($deferred, $parentRenderPromise) {
        var notifyBeforeRenderDone = enclose($deferred.notify).prependArgs(BEFORE_RENDER_DONE).bindContext($deferred).final,
            waitForParentPromiseToBeResolved = enclose(_waitForParentPromiseToBeResolved).prependArgs($parentRenderPromise).final,
            afterRender = enclose(_afterRender).prependArgs($deferred).bindContext(this).final,
            renderAndAfterRender = enclose(_renderAndAfterRender).prependArgs($deferred, afterRender).bindContext(this).final,
            rejectStart = enclose($deferred.reject).bindContext(this).final;

        $
            .when(_runLifeCycleMethod.call(this, this.beforeRender))
            .always(notifyBeforeRenderDone)
            .then(waitForParentPromiseToBeResolved)
            .then(
                renderAndAfterRender,
                rejectStart);
    }

    /**
     * Life cycle methods have an event triggered before the run.
     * If a life cycle method has one or more arguments, then the first argument passed in is its deferred.
     * The life cycle method will automatically return this deferred, otherwise it will pass through whatever
     * the method itself returns.
     *
     * @param lifeCycleMethod
     * @returns {*}
     * @private
     */
    function _runLifeCycleMethod (lifeCycleMethod) {
        if (!lifeCycleMethod) {
            return undefined;
        }

        return configureMethod({}, lifeCycleMethod).methodWithDefaultOptions({
            async : lifeCycleMethod.length
        }).methodWithActualOptions.call(this);
    }

    function _waitForParentPromiseToBeResolved ($parentRenderPromise) {
        if ($parentRenderPromise) {
            return $parentRenderPromise;
        }
        return undefined;
    }

    function _renderAndAfterRender ($deferred, afterRender) {
        var rejectStart = enclose($deferred.reject).bindContext(this).closure.final;
        $
            .when(_runLifeCycleMethod.call(this, this.render))
            .always(enclose($deferred.notify).prependArgs(RENDER_DONE).bindContext($deferred).closure.final)
            .then(
                afterRender,
                rejectStart);
    }

    function _afterRender ($deferred) {
        var $afterRenderDeferred = _runLifeCycleMethod.call(this, this.afterRender),
            resolveStart = enclose($deferred.resolve).bindContext(this).closure.final,
            rejectStart = enclose($deferred.reject).bindContext(this).closure.final;
        $
            .when(
                $afterRenderDeferred,
                _startChildren.call(this, $deferred)
            )
            .always(enclose($deferred.notify).prependArgs(AFTER_RENDER_DONE).bindContext($deferred).closure.final)
            .then(
                resolveStart,
                rejectStart);
    }

    function _startChildren ($parentDeferred) {
        _(this.children).each(function (child) {
            var $afterRenderDeferred = new $.Deferred();
            $parentDeferred.progress(function (step) {
                if (step === RENDER_DONE) {
                    $afterRenderDeferred.resolve();
                }
            });

            child.start($afterRenderDeferred.promise());
        });
    }
});
