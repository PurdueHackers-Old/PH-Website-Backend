import axios from 'axios';
import { Job } from 'bull';
import { Event } from '../models/event';
import CONFIG from '../config';
import { createLogger } from '../utils/logger';
const { FACEBOOK_ACCESS_TOKEN: accessToken } = CONFIG;
const logger = createLogger('Facebook worker');

const getFacebookEvents = async () => {
	try {
		const untilDate = new Date();
		const sinceDate = new Date();
		sinceDate.setFullYear(untilDate.getFullYear() - 1);

		// retrieves all events that happened in the past year
		const {
			data: { data: facebookEvents }
		} = await axios.get('https://graph.facebook.com/purduehackers/events', {
			params: {
				access_token: accessToken,
				limit: 1000, // number of events that could possibly be returned
				since: sinceDate, // unix timestamp of one year ago
				until: untilDate
			}
		});

		return facebookEvents;
	} catch (error) {
		logger.error('Error getting facebook events');
	}
};

const updateDatabase = async (facebookEvents: any) => {
	const untilDate = new Date();
	const sinceDate = new Date();
	sinceDate.setFullYear(untilDate.getFullYear() - 1);

	const eventsLinks = await Event.find({ facebook: { $exists: true, $ne : "" }, eventTime: { $gte: sinceDate }}).exec().then(result => result.map(event => {
		return event.facebook;
	}));

	for (const currEvent of facebookEvents) {
		const {
			id: facebookId,
			name: eventName,
			place: { name: eventLocation },
			start_time: eventTime
		} = currEvent;

		const facebook = `https://www.facebook.com/events/${facebookId}/`;
		if (!eventsLinks.includes(facebook)) {
			// Create db event
			const event = new Event({
				name: eventName,
				location: eventLocation,
				privateEvent: false,
				eventTime,
				facebook
			});

			await event.save();
			logger.info('Created Event:', event);
		} else {
			// Update event
			await Event.findOneAndUpdate(
				{
					facebook
				},
				{
					$set: {
						name: eventName,
						location: eventLocation,
						privateEvent: false,
						eventTime,
						facebook
					}
				}
			).exec();
			logger.info(
				'Updated event:',
				await Event.findOne({ facebook })
					.lean()
					.exec()
			);

			// remove the event from the upcoming facebook events in db list
			eventsLinks.splice(eventsLinks.indexOf(facebook), 1);
		}
	}

	// Reflect facebook event deletions in the database
	if (eventsLinks.length > 0) {
		for (const currEventInTheDatabaseFacebookLink of eventsLinks) {
			const e = await Event.findOneAndDelete({
				facebook: { $eq: currEventInTheDatabaseFacebookLink }
			}).exec();
			logger.info('Deleted event', e);
		}
	}
};

export const syncFacebookEvents = async () => {
	// Get all upcoming facebook events id's
	const facebookEvents = await getFacebookEvents();
	logger.info('Got facebook events:', facebookEvents);
	await updateDatabase(facebookEvents);
};

// export this test function that will allow the test file to simply enter fake facebook events
// to test mainly the database functions. This way tests will be permanent
export const testSyncFacebookEvents = updateDatabase;
