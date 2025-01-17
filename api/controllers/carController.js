import Env from '../config/env.config.js'
import strings from '../config/app.config.js'
import Car from '../models/Car.js'
import Booking from '../models/Booking.js'
import fs from 'fs'
import path from 'path'
import { v1 as uuid } from 'uuid'
import escapeStringRegexp from 'escape-string-regexp'
import mongoose from 'mongoose'
import * as Helper from '../common/Helper.js'

const CDN = process.env.BC_CDN_CARS
const CDN_TEMP = process.env.BC_CDN_TEMP_CARS

export const create = (req, res) => {
    const { body } = req

    if (!body.image) {
        console.error(`[car.create]  ${strings.CAR_IMAGE_REQUIRED} ${req.body}`)
        res.status(400).send(strings.CAR_IMAGE_REQUIRED + err)
        return
    }

    const car = new Car(req.body)

    car.save()
        .then(async car => {

            if (car.image) {
                const image = path.join(CDN_TEMP, body.image)

                if (await Helper.fileExists(image)) {
                    const filename = `${car._id}_${Date.now()}${path.extname(body.image)}`
                    const newPath = path.join(CDN, filename)

                    try {
                        await fs.promises.rename(image, newPath)
                        car.image = filename
                        try {
                            await car.save()
                        } catch (err) {
                            console.error(strings.DB_ERROR, err)
                            res.status(400).send(strings.DB_ERROR + err)
                        }
                    } catch (err) {
                        console.error(strings.ERROR, err)
                        res.status(400).send(strings.ERROR + err)
                    }
                } else {
                    console.error(strings.CAR_IMAGE_NOT_FOUND, body)

                    try {
                        await Car.deleteOne({ _id: car._id })
                    } catch (err) {
                        console.error(strings.DB_ERROR, err)
                        res.status(400).send(strings.DB_ERROR + err)
                    }
                    finally {
                        res.status(400).send(strings.CAR_IMAGE_NOT_FOUND + body)
                    }

                    return
                }
            }

            res.json(car)
        })
        .catch(err => {
            console.error(`[car.create]  ${strings.DB_ERROR} ${req.body}`, err)
            res.status(400).send(strings.DB_ERROR + err)
        })
}

export const update = (req, res) => {
    Car.findById(req.body._id)
        .then(car => {
            if (car) {
                const {
                    company,
                    name,
                    minimumAge,
                    available,
                    type,
                    locations,
                    price,
                    deposit,
                    seats,
                    doors,
                    aircon,
                    gearbox,
                    fuelPolicy,
                    mileage,
                    cancellation,
                    amendments,
                    theftProtection,
                    collisionDamageWaiver,
                    fullInsurance,
                    additionalDriver
                } = req.body

                car.company = company._id
                car.minimumAge = minimumAge
                car.locations = locations
                car.name = name
                car.available = available
                car.type = type
                car.price = price
                car.deposit = deposit
                car.seats = seats
                car.doors = doors
                car.aircon = aircon
                car.gearbox = gearbox
                car.fuelPolicy = fuelPolicy
                car.mileage = mileage
                car.cancellation = cancellation
                car.amendments = amendments
                car.theftProtection = theftProtection
                car.collisionDamageWaiver = collisionDamageWaiver
                car.fullInsurance = fullInsurance
                car.additionalDriver = additionalDriver

                car.save()
                    .then(() => res.sendStatus(200))
                    .catch(err => {
                        console.error(`[car.update]  ${strings.DB_ERROR} ${req.body}`, err)
                        res.status(400).send(strings.DB_ERROR + err)
                    })
            } else {
                console.error('[car.update] Car not found:', req.body._id)
                res.sendStatus(204)
            }
        })
        .catch(err => {
            console.error(`[car.update]  ${strings.DB_ERROR} ${req.body}`, err)
            res.status(400).send(strings.DB_ERROR + err)
        })
}

export const checkCar = (req, res) => {
    const id = new mongoose.Types.ObjectId(req.params.id)

    Booking.find({ car: id })
        .limit(1)
        .count()
        .then(count => {
            if (count === 1) {
                return res.sendStatus(200)
            }
            return res.sendStatus(204)
        })
        .catch(err => {
            console.error(`[car.checkCar]  ${strings.DB_ERROR} ${id}`, err)
            res.status(400).send(strings.DB_ERROR + err)
        })
}

export const deleteCar = async (req, res) => {
    const id = req.params.id

    try {
        const car = await Car.findByIdAndDelete(id)
        if (car) {
            if (car.image) {
                const image = path.join(CDN, car.image)
                if (await Helper.fileExists(image)) {
                    await fs.promises.unlink(image)
                }
            }
            await Booking.deleteMany({ car: car._id })
        } else {
            return res.sendStatus(404)
        }
        return res.sendStatus(200)
    } catch (err) {
        console.error(`[car.delete]  ${strings.DB_ERROR} ${id}`, err)
        return res.status(400).send(strings.DB_ERROR + err)
    }
}

export const createImage = async (req, res) => {
    try {
        if (!await Helper.fileExists(CDN_TEMP)) {
            await fs.promises.mkdir(CDN_TEMP, { recursive: true })
        }

        const filename = `${uuid()}_${Date.now()}${path.extname(req.file.originalname)}`
        const filepath = path.join(CDN_TEMP, filename)

        await fs.promises.writeFile(filepath, req.file.buffer)
        res.json(filename)
    } catch (err) {
        console.error(strings.ERROR, err)
        res.status(400).send(strings.ERROR + err)
    }
}

export const updateImage = (req, res) => {

    Car.findById(req.params.id)
        .then(async car => {
            if (car) {
                if (await Helper.fileExists(CDN)) {
                    await fs.promises.mkdir(CDN, { recursive: true })
                }

                if (car.image) {
                    const image = path.join(CDN, car.image)
                    if (await Helper.fileExists(image)) {
                        await fs.promises.unlink(image)
                    }
                }

                const filename = `${car._id}_${Date.now()}${path.extname(req.file.originalname)}`
                const filepath = path.join(CDN, filename)

                await fs.promises.writeFile(filepath, req.file.buffer)
                car.image = filename
                car.save()
                    .then(usr => {
                        res.sendStatus(200)
                    })
                    .catch(err => {
                        console.error(strings.DB_ERROR, err)
                        res.status(400).send(strings.DB_ERROR + err)
                    })
            } else {
                console.error('[car.updateImage] Car not found:', req.params.id)
                res.sendStatus(204)
            }
        })
        .catch(err => {
            console.error(strings.DB_ERROR, err)
            res.status(400).send(strings.DB_ERROR + err)
        })
}

export const deleteImage = (req, res) => {

    Car.findById(req.params.id)
        .then(async car => {
            if (car) {
                if (car.image) {
                    const image = path.join(CDN, car.image)
                    if (await Helper.fileExists(image)) {
                        await fs.promises.unlink(image)
                    }
                }
                car.image = null

                car.save()
                    .then(() => {
                        res.sendStatus(200)
                    })
                    .catch(err => {
                        console.error(strings.DB_ERROR, err)
                        res.status(400).send(strings.DB_ERROR + err)
                    })
            } else {
                console.error('[car.deleteImage] Car not found:', req.params.id)
                res.sendStatus(204)
            }
        })
        .catch(err => {
            console.error(strings.DB_ERROR, err)
            res.status(400).send(strings.DB_ERROR + err)
        })
}

export const deleteTempImage = async (req, res) => {
    try {
        const image = path.join(CDN_TEMP, req.params.image)
        if (await Helper.fileExists(image)) {
            await fs.promises.unlink(image)
        }
        res.sendStatus(200)
    } catch (err) {
        console.error(strings.ERROR, err)
        res.status(400).send(strings.ERROR + err)
    }
}

export const getCar = (req, res) => {
    Car.findById(req.params.id)
        .populate('company')
        .populate({
            path: 'locations',
            populate: {
                path: 'values',
                model: 'LocationValue',
            }
        })
        .lean()
        .then(car => {
            if (car) {
                if (car.company) {
                    const { _id, fullName, avatar, payLater } = car.company
                    car.company = { _id, fullName, avatar, payLater }
                }

                for (let i = 0; i < car.locations.length; i++) {
                    const location = car.locations[i]
                    location.name = location.values.filter(value => value.language === req.params.language)[0].value
                }

                res.json(car)
            } else {
                console.error('[car.getCar] Car not found:', req.params.id)
                res.sendStatus(204)
            }
        })
        .catch(err => {
            console.error(`[car.getCar] ${strings.DB_ERROR} ${req.params.id}`, err)
            res.status(400).send(strings.DB_ERROR + err)
        })
}

export const getCars = async (req, res) => {
    try {

        const page = parseInt(req.params.page)
        const size = parseInt(req.params.size)
        const companies = req.body.companies.map(id => new mongoose.Types.ObjectId(id))
        const fuel = req.body.fuel
        const gearbox = req.body.gearbox
        const mileage = req.body.mileage
        const deposit = req.body.deposit
        const availability = req.body.availability
        const keyword = escapeStringRegexp(req.query.s || '')
        const options = 'i'

        const $match = {
            $and: [
                { name: { $regex: keyword, $options: options } },
                { company: { $in: companies } }
            ]
        }

        if (fuel) {
            $match.$and.push({ type: { $in: fuel } })
        }

        if (gearbox) {
            $match.$and.push({ gearbox: { $in: gearbox } })
        }

        if (mileage) {
            if (mileage.length === 1 && mileage[0] === Env.MILEAGE.LIMITED) {
                $match.$and.push({ mileage: { $gt: -1 } })
            } else if (mileage.length === 1 && mileage[0] === Env.MILEAGE.UNLIMITED) {
                $match.$and.push({ mileage: -1 })
            } else if (mileage.length === 0) {
                return res.json([{ resultData: [], pageInfo: [] }])
            }
        }

        if (deposit && deposit > -1) {
            $match.$and.push({ deposit: { $lte: deposit } })
        }

        if (availability) {
            if (availability.length === 1 && availability[0] === Env.AVAILABILITY.AVAILABLE) {
                $match.$and.push({ available: true })
            } else if (availability.length === 1 && availability[0] === Env.AVAILABILITY.UNAVAILABLE) {
                $match.$and.push({ available: false })
            } else if (availability.length === 0) {
                return res.json([{ resultData: [], pageInfo: [] }])
            }
        }

        const cars = await Car.aggregate([
            { $match },
            {
                $lookup: {
                    from: 'User',
                    let: { userId: '$company' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$_id', '$$userId'] }
                            }
                        }
                    ],
                    as: 'company'
                }
            },
            { $unwind: { path: '$company', preserveNullAndEmptyArrays: false } },
            {
                $lookup: {
                    from: 'Location',
                    let: { locations: '$locations' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $in: ['$_id', '$$locations'] }
                            }
                        }
                    ],
                    as: 'locations'
                }
            },
            {
                $facet: {
                    resultData: [
                        { $sort: { name: 1 } },
                        { $skip: ((page - 1) * size) },
                        { $limit: size },
                    ],
                    pageInfo: [
                        {
                            $count: 'totalRecords'
                        }
                    ]
                }
            }
        ], { collation: { locale: Env.DEFAULT_LANGUAGE, strength: 2 } })

        cars.forEach(car => {
            if (car.company) {
                const { _id, fullName, avatar } = car.company
                car.company = { _id, fullName, avatar }
            }
        })

        return res.json(cars)
    } catch (err) {
        console.error(`[car.getCars]  ${strings.DB_ERROR} ${req.query.s}`, err)
        return res.status(400).send(strings.DB_ERROR + err)
    }
}

export const getBookingCars = async (req, res) => {
    try {
        const company = new mongoose.Types.ObjectId(req.body.company)
        const pickupLocation = new mongoose.Types.ObjectId(req.body.pickupLocation)
        const keyword = escapeStringRegexp(req.query.s || '')
        const options = 'i'
        const page = parseInt(req.params.page)
        const size = parseInt(req.params.size)

        const cars = await Car.aggregate([
            {
                $match: {
                    $and: [
                        { company: { $eq: company } },
                        { locations: pickupLocation },
                        { available: true },
                        { name: { $regex: keyword, $options: options } }
                    ]
                }
            },
            { $sort: { name: 1 } },
            { $skip: ((page - 1) * size) },
            { $limit: size }
        ], { collation: { locale: Env.DEFAULT_LANGUAGE, strength: 2 } })

        return res.json(cars)
    } catch (err) {
        console.error(`[car.getBookingCars]  ${strings.DB_ERROR} ${req.query.s}`, err)
        return res.status(400).send(strings.DB_ERROR + err)
    }
}

export const getFrontendCars = async (req, res) => {
    try {
        const page = parseInt(req.params.page)
        const size = parseInt(req.params.size)
        const companies = req.body.companies.map(id => new mongoose.Types.ObjectId(id))
        const pickupLocation = new mongoose.Types.ObjectId(req.body.pickupLocation)
        const fuel = req.body.fuel
        const gearbox = req.body.gearbox
        const mileage = req.body.mileage
        const deposit = req.body.deposit

        const $match = {
            $and: [
                { company: { $in: companies } },
                { locations: pickupLocation },
                { available: true },
                { type: { $in: fuel } },
                { gearbox: { $in: gearbox } }
            ]
        }

        if (mileage) {
            if (mileage.length === 1 && mileage[0] === Env.MILEAGE.LIMITED) {
                $match.$and.push({ mileage: { $gt: -1 } })
            } else if (mileage.length === 1 && mileage[0] === Env.MILEAGE.UNLIMITED) {
                $match.$and.push({ mileage: -1 })
            } else if (mileage.length === 0) {
                return res.json([{ resultData: [], pageInfo: [] }])
            }
        }

        if (deposit > -1) {
            $match.$and.push({ deposit: { $lte: deposit } })
        }

        const cars = await Car.aggregate([
            { $match },
            {
                $lookup: {
                    from: 'User',
                    let: { userId: '$company' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$_id', '$$userId'] }
                            }
                        }
                    ],
                    as: 'company'
                }
            },
            { $unwind: { path: '$company', preserveNullAndEmptyArrays: false } },
            {
                $lookup: {
                    from: 'Location',
                    let: { locations: '$locations' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $in: ['$_id', '$$locations'] }
                            }
                        }
                    ],
                    as: 'locations'
                }
            },
            {
                $facet: {
                    resultData: [
                        { $sort: { name: 1 } },
                        { $skip: ((page - 1) * size) },
                        { $limit: size },
                    ],
                    pageInfo: [
                        {
                            $count: 'totalRecords'
                        }
                    ]
                }
            }
        ], { collation: { locale: Env.DEFAULT_LANGUAGE, strength: 2 } })

        cars.forEach(car => {
            if (car.company) {
                const { _id, fullName, avatar } = car.company
                car.company = { _id, fullName, avatar }
            }
        })

        return res.json(cars)
    } catch (err) {
        console.error(`[car.getCars]  ${strings.DB_ERROR} ${req.query.s}`, err)
        return res.status(400).send(strings.DB_ERROR + err)
    }
}
