function getUpcomingEventsForCurrentYear(events) {
    const today = new Date();
    const currentYear = today.getFullYear();
    return events
        .filter(event => event.date > today && event.date.getFullYear() === currentYear)
        .sort((a, b) => a.date - b.date);
}

function getEventsForToday(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set the time to the start of the day

    return events.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0); // Set the time to the start of the day
        return eventDate.getTime() === today.getTime();
    });
}

module.exports = {
    getUpcomingEventsForCurrentYear,
    getEventsForToday
};
