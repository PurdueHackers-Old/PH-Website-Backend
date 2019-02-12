import 'jest';
import Server from '../../src/server';
import * as supertest from 'supertest';
import { spoofFacebookEvents, generateEvents } from '../helper';
import { testSyncFacebookEvents } from '../../src/workers/facebook';
import { Event } from '../../src/models/event';

let server: Server;
let request: supertest.SuperTest<supertest.Test>;

describe('Facebook Event Integration Tests', () => {
	beforeAll(() =>
		Server.createInstance().then(s => {
			server = s;
			request = supertest(s.app);
		})
	);

	it('Successfully adds new upcoming events from facebook to the db', async () => {
		// Generate default events that dont have a facebook link
		await Promise.all(generateEvents(7).map(async (event) => {
			delete event.facebook;
			await new Event(event).save();
		}));

		const facebookEvents = spoofFacebookEvents(3);
		await testSyncFacebookEvents(facebookEvents);
		const databaseEvents = await Event.find({}, '_id name location eventTime facebook').exec();

		expect(databaseEvents).toHaveLength(10);

		for (const event of facebookEvents) {
			expect(databaseEvents).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: event.name,
						location: event.place.name,
						eventTime: event.start_time,
						facebook: `https://www.facebook.com/events/${event.id}/`
					})
				])
			);
		}
	});

	it('Successfully updates upcoming events from facebook in the db', async () => {
		const originalFacebookEvent = spoofFacebookEvents(1);
		await testSyncFacebookEvents(originalFacebookEvent);
		const databaseEventsOriginal = await Event.find(
			{},
			'_id name location eventTime facebook'
		).exec();

		const facebookEvent = spoofFacebookEvents(1);
		await testSyncFacebookEvents(facebookEvent);
		const databaseEvents = await Event.find({}, '_id name location eventTime facebook').exec();

		expect(databaseEvents.length).toEqual(1);
		expect(databaseEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: facebookEvent[0].name,
					location: facebookEvent[0].place.name,
					eventTime: facebookEvent[0].start_time,
					facebook: `https://www.facebook.com/events/${facebookEvent[0].id}/`
				})
			])
		);
	});

	it('Deletes an upcoming event from the database, if its deleted from facebook', async () => {
		// Generate default events that have a facebook link
		const events = generateEvents(7);
		await Promise.all(events.map(async (event) => {
			await new Event(event).save();
		}));

		const facebookEvent = spoofFacebookEvents(1);
		await testSyncFacebookEvents(facebookEvent);
		const databaseEvents = await Event.find({}, '_id name location eventTime facebook').exec();
		console.log('DB Events: ', databaseEvents);
		expect(databaseEvents.length).toEqual(1);
	});

	it('Doesnt create duplicate events on sync', async () => {
		// Generate default events that dont have a facebook link
		await Promise.all(generateEvents(7).map(async (event) => {
			await new Event(event).save();
		}));

		const facebookEvents = spoofFacebookEvents(3);
		await testSyncFacebookEvents(facebookEvents);
		await Event.find({}, '_id name location eventTime facebook').exec();

		await testSyncFacebookEvents(facebookEvents);
		const databaseEvents = await Event.find({}, '_id name location eventTime facebook').exec();

		expect(databaseEvents).toHaveLength(3);

		for (const event of facebookEvents) {
			expect(databaseEvents).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: event.name,
						location: event.place.name,
						eventTime: event.start_time,
						facebook: `https://www.facebook.com/events/${event.id}/`
					})
				])
			);
		}
	});

	afterEach(() => server.mongoose.connection.dropDatabase());

	afterAll(() => server.mongoose.disconnect());
});
