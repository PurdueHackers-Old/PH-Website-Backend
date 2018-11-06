import * as faker from 'faker';

export const generateUser = () => {
	const first = faker.name.firstName();
	const last = faker.name.lastName();
	const email = faker.internet.email(first, last);
	const password = faker.internet.password(8);
	return {
		name: `${first} ${last}`,
		email,
		graduationYear: faker.random.number({
			min: 1900,
			max: 2025
		}),
		password,
		passwordConfirm: password
	};
};

export const generateEvent = () => {
	const name = faker.hacker.noun();
	const eventTime = faker.date.past();
	const location = faker.address.streetAddress();
	const facebook = `https://www.facebook.com/events/${faker.random.number({
		min: 100000000000000,
		max: 999999999999999
	})}/`;

	return {
		name,
		eventTime,
		location,
		facebook
	};
};

export const generateUsers = numUsers => Array.from({ length: numUsers }, generateUser);
export const generateEvents = numEvents => Array.from({ length: numEvents }, generateEvent);
