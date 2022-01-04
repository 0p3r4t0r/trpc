import { observable } from './observable';
import { share } from './operators/share';
import { EventEmitter } from 'events';
import { map } from './operators';
import { expectTypeOf } from 'expect-type';

test('smoke', () => {
  const obs = observable<number, Error>((observer) => {
    observer.next(1);
    observer.complete();
  });

  const next = jest.fn();
  const error = jest.fn();
  const complete = jest.fn();
  obs.subscribe({
    next,
    error,
    complete,
  });
  expect(next.mock.calls).toHaveLength(1);
  expect(complete.mock.calls).toHaveLength(1);
  expect(error.mock.calls).toHaveLength(0);
  expect(next.mock.calls[0][0]).toBe(1);
});

test('share', () => {
  const obs = share()(
    observable<number, Error>((observer) => {
      observer.next(1);
    }),
  );
  {
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    obs.subscribe({
      next,
      error,
      complete,
    });
    expect(next.mock.calls).toHaveLength(1);
    expect(complete.mock.calls).toHaveLength(0);
    expect(error.mock.calls).toHaveLength(0);
    expect(next.mock.calls[0][0]).toBe(1);
  }

  {
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    obs.subscribe({
      next,
      error,
      complete,
    });
    expect(next.mock.calls).toHaveLength(0);
    expect(complete.mock.calls).toHaveLength(0);
    expect(error.mock.calls).toHaveLength(0);
  }
});

test('pipe', () => {
  const obs = observable<number, Error>((observer) => {
    observer.next(1);
  }).pipe(share());
  {
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    obs.subscribe({
      next,
      error,
      complete,
    });
    expect(next.mock.calls).toHaveLength(1);
    expect(complete.mock.calls).toHaveLength(0);
    expect(error.mock.calls).toHaveLength(0);
    expect(next.mock.calls[0][0]).toBe(1);
  }

  {
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    obs.subscribe({
      next,
      error,
      complete,
    });
    expect(next.mock.calls).toHaveLength(0);
    expect(complete.mock.calls).toHaveLength(0);
    expect(error.mock.calls).toHaveLength(0);
  }
});

interface SubscriptionEvents<TOutput> {
  data: (data: TOutput) => void;
}
declare interface CustomEventEmitter<TOutput> {
  on<U extends keyof SubscriptionEvents<TOutput>>(
    event: U,
    listener: SubscriptionEvents<TOutput>[U],
  ): this;

  once<U extends keyof SubscriptionEvents<TOutput>>(
    event: U,
    listener: SubscriptionEvents<TOutput>[U],
  ): this;

  emit<U extends keyof SubscriptionEvents<TOutput>>(
    event: U,
    ...args: Parameters<SubscriptionEvents<TOutput>[U]>
  ): boolean;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class CustomEventEmitter<TOutput> extends EventEmitter {}

test('map', () => {
  type EventShape = { num: number };
  const ee = new CustomEventEmitter<EventShape>();
  const eventObservable = observable<EventShape, unknown>((subscriber) => {
    const callback = (data: EventShape) => {
      subscriber.next(data);
    };
    ee.on('data', callback);

    return () => {
      ee.off('data', callback);
    };
  });
  const pipeCalls = jest.fn();
  const piped = eventObservable.pipe(
    map((...args) => {
      pipeCalls(...args);
      const [value] = args;
      return value.num;
    }),
  );

  const next = jest.fn();
  const subscription = piped.subscribe({
    next(value) {
      expectTypeOf<number>(value);
      next(value);
    },
  });
  expect(next).not.toHaveBeenCalled();
  ee.emit('data', { num: 1 });
  ee.emit('data', { num: 2 });
  expect(next).toHaveBeenCalledTimes(2);
  expect(next.mock.calls).toEqual([[1], [2]]);
  expect(pipeCalls.mock.calls).toEqual([
    [{ num: 1 }, 0],
    [{ num: 2 }, 1],
  ]);

  expect(ee.listeners('data')).toHaveLength(1);
  subscription.unsubscribe();
  expect(ee.listeners('data')).toHaveLength(0);
});