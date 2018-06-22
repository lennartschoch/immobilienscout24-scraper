const cheerio = require('cheerio');

const parseArea = (text) => {
    const areaRegex = /(\d*.\d*) m²/.exec(text);
    return areaRegex ? parseFloat(areaRegex[1].replace(',', '.')) : null;
};

const parsePrice = (text) => {
    const sanitizedText = text.replace('.', '').replace(',', '.');
    const priceRegex = /(\d+\D?\d*)\s*€/.exec(sanitizedText);
    return priceRegex ? parseFloat(priceRegex[1]) : null;
};

const scrapAddress = (addressBlock) => {
    const result = {};

    // Structure of address changed

    if (addressBlock.children().length === 2) {
        result.address = addressBlock.children().first().text().split(',')[0].trim();
    }

    const zipAndCity = addressBlock.find('.zip-region-and-country').text().split(',')[0];
    const addressRegex = /(\d{5}) (\S+)/.exec(zipAndCity);

    result.postalCode = addressRegex ? addressRegex[1] : null;
    result.city = addressRegex ? addressRegex[2] : null;

    return result;
};

const scrapImages = (sliderBlock) => {
    if (!sliderBlock.length) {
        return [];
    }
    return sliderBlock.find('img.sp-image').map((i, img) => img.attribs['data-src']).get();
}

const parseAvailableFrom = (text) => {
    if (text) {
        // Date format changed
        const dateRegex = /^\D+(\d{1,2}\.\d{1,2}\.\d{2})\s*$/.exec(text);
        if (dateRegex) {
            const dateStr = '20'+dateRegex[1].split('.').reverse().join('-');
            const date = new Date(dateStr);
            return {
                availableFrom: date,
                isAvailable: date.getTime() < (new Date()).getTime(),
            };
        // Available apartments might also say 'Ab sofort', so I've replaced the 'trim' function by an 'indexOf'
        } else if (text.indexOf('sofort') !== -1) {
            return {
                availableFrom: null,
                isAvailable: true,
            };
        }
    }
    return {
        availableFrom: null,
        isAvailable: false,
    };
};

exports.scrap = (page) => {
    const $ = cheerio.load(page, {
        decodeEntities: false,
        normalizeWhitespace: true,
    });

    let apartment = {};

    apartment.rentBase = parsePrice($('.is24qa-kaltmiete').text());
    apartment.rentTotal = parsePrice($('.is24qa-gesamtmiete').text());
    apartment.area = parseArea($('.is24qa-wohnflaeche-ca').text().replace(',', '.'));
    apartment.rooms = parseInt($('.is24qa-zi').text(), 10);
    // ID changed
    apartment.images = scrapImages($('#fullscreenSlider'));

    const availability = parseAvailableFrom($('.is24qa-bezugsfrei-ab').text());
    apartment = Object.assign(apartment, availability);

    // Address block is not an h4 anymore. Also, only get the first occurence of the element
    const addressBlock = $('.address-block [data-ng-non-bindable]').first();
    if (addressBlock && addressBlock.text().trim()) {
        // Use address as element to make parsing easier.
        const addressInfo = scrapAddress(addressBlock);
        apartment = Object.assign(apartment, addressInfo);
    }

    return apartment;
};
