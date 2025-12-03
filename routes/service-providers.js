const express = require("express");
const ServiceProviderModel = require("../models/serviceProvider.schema");
const { authenticateToken, adminOnly } = require("../middlewear/verifycommonMiddlewaer");
const { successHandler, failureHandler } = require("../utlits/helper/helper");
const serviceProviders = express.Router();

// GET /api/v1/admin/serviceProvider/all
serviceProviders.get("/all", authenticateToken, adminOnly, async (req, res) => {
    try {
        const query = req.query;

        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

        // ----------- WHERE FILTERS -----------
        const where = {};

        if (query.search) {
            where.$or = [
                { name: { $regex: query.search, $options: "i" } },
                { email: { $regex: query.search, $options: "i" } },
                { serviceCategory: { $regex: query.search, $options: "i" } },
                { serviceArea: { $regex: query.search, $options: "i" } },
            ];
        }

        if (query.status) {
            where.status = query.status;
        }

        if (query.category) {
            where.serviceCategory = { $regex: query.category, $options: "i" };
        }

        // ----------- SORTING -----------
        let sort = {};
        if (query.sort) {
            sort[query.sort] = query.order === "desc" ? -1 : 1;
        } else {
            sort.createdAt = -1; // default: newest first
        }

        // ----------- FETCH DATA -----------
        const [serviceProvidersList, total] = await Promise.all([
            ServiceProviderModel.find(where)
                .select(
                    "name username email phone serviceCategory serviceArea status rating totalReviews completedJobs registrationDate shortIntro availability vehicles serviceBookings serviceReviews createdAt"
                )
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            ServiceProviderModel.countDocuments(where),
        ]);

        // Format response with counts
        const serviceProvidersWithCounts = serviceProvidersList.map((provider) => ({
            id: provider._id || provider.id,
            name: provider.name,
            username: provider.username,
            email: provider.email,
            phone: provider.phone,
            serviceCategory: provider.serviceCategory,
            serviceArea: provider.serviceArea,
            status: provider.status,
            rating: provider.rating,
            totalReviews: provider.totalReviews,
            completedJobs: provider.completedJobs,
            registrationDate: provider.registrationDate,
            shortIntro: provider.shortIntro,
            availability: provider.availability,
            createdAt: provider.createdAt,
            _count: {
                vehicles: provider.vehicles ? (Array.isArray(provider.vehicles) ? provider.vehicles.length : 0) : 0,
                serviceBookings: provider.serviceBookings ? (Array.isArray(provider.serviceBookings) ? provider.serviceBookings.length : 0) : 0,
                serviceReviews: provider.serviceReviews ? (Array.isArray(provider.serviceReviews) ? provider.serviceReviews.length : 0) : 0,
            },
        }));

        return res.json(
            successHandler(200, {
                serviceProviders: serviceProvidersWithCounts,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            }, "Service providers fetched successfully")
        );

    } catch (error) {
        console.error("Get service providers error:", error);
        return res.status(500).json(
            failureHandler(500, "Failed to fetch service providers")
        );
    }
});

// PATCH /api/v1/admin/serviceProvider/:id/approval
serviceProviders.put("/:id/approval", authenticateToken, adminOnly, async (req, res) => {
    try {
        const serviceProviderId = req.params.id;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json(
                failureHandler(400, "Status must be 'approved' or 'rejected'")
            );
        }

        // Check if service provider exists
        const serviceProvider = await ServiceProviderModel.findById(serviceProviderId);
        if (!serviceProvider) {
            return res.status(404).json(
                failureHandler(404, "Service provider not found")
            );
        }

        // Update status
        const updatedServiceProvider = await ServiceProviderModel.findByIdAndUpdate(
            serviceProviderId,
            { status },
            { new: true, runValidators: true }
        ).select("name username email status rating totalReviews completedJobs registrationDate createdAt");

        return res.json(
            successHandler(200, {
                serviceProvider: {
                    id: updatedServiceProvider._id,
                    name: updatedServiceProvider.name,
                    username: updatedServiceProvider.username,
                    email: updatedServiceProvider.email,
                    status: updatedServiceProvider.status,
                    rating: updatedServiceProvider.rating,
                    totalReviews: updatedServiceProvider.totalReviews,
                    completedJobs: updatedServiceProvider.completedJobs,
                    registrationDate: updatedServiceProvider.registrationDate,
                    createdAt: updatedServiceProvider.createdAt,
                }
            }, `Service provider ${status} successfully`)
        );
    } catch (error) {
        console.error("Approve service provider error:", error);
        return res.status(500).json(
            failureHandler(500, "Failed to update approval status")
        );
    }
});

// DELETE /api/v1/admin/serviceProvider/:id
serviceProviders.delete("/:id", authenticateToken, adminOnly, async (req, res) => {
    try {
        const serviceProviderId = req.params.id;

        // Check if service provider exists
        const serviceProvider = await ServiceProviderModel.findById(serviceProviderId);
        if (!serviceProvider) {
            return res.status(404).json(
                failureHandler(404, "Service provider not found")
            );
        }

        // Delete service provider
        await ServiceProviderModel.findByIdAndDelete(serviceProviderId);

        return res.json(
            successHandler(200, {}, "Service provider deleted successfully")
        );
    } catch (error) {
        console.error("Delete service provider error:", error);
        return res.status(500).json(
            failureHandler(500, "Failed to delete service provider")
        );
    }
});

// GET /api/v1/admin/serviceProvider/stats/overview
serviceProviders.get("/stats/overview", authenticateToken, adminOnly, async (req, res) => {
    try {
        // Get counts for service providers
        const [
            totalServiceProviders,
            approvedServiceProviders,
            pendingServiceProviders,
            rejectedServiceProviders,
        ] = await Promise.all([
            ServiceProviderModel.countDocuments(),
            ServiceProviderModel.countDocuments({ status: "approved" }),
            ServiceProviderModel.countDocuments({ status: "pending" }),
            ServiceProviderModel.countDocuments({ status: "rejected" }),
        ]);

        // Try to get counts for related models (if they exist)
        let totalVehicles = 0;
        let totalServiceBookings = 0;
        let totalServiceReviews = 0;
        let openServiceBookings = 0;

        try {
            // Check if Vehicle model exists
            const VehicleModel = require("../models/serviceProviderVehicle.schema");
            if (VehicleModel) {
                totalVehicles = await VehicleModel.countDocuments();
            }
        } catch (err) {
            // Model doesn't exist, keep default 0
        }

        try {
            // Check if ServiceBooking model exists
            const ServiceBookingModel = require("../models/serviceBooking.schema");
            if (ServiceBookingModel) {
                totalServiceBookings = await ServiceBookingModel.countDocuments();
                openServiceBookings = await ServiceBookingModel.countDocuments({ status: "open" });
            }
        } catch (err) {
            // Model doesn't exist, keep default 0
        }

        try {
            // Check if ServiceReview model exists
            const ServiceReviewModel = require("../models/serviceReview.schema");
            if (ServiceReviewModel) {
                totalServiceReviews = await ServiceReviewModel.countDocuments();
            }
        } catch (err) {
            // Model doesn't exist, keep default 0
        }

        // Get recent registrations (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentRegistrations = await ServiceProviderModel.find({
            createdAt: { $gte: sevenDaysAgo }
        })
            .select("name username email serviceCategory status createdAt")
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        const formattedRecentRegistrations = recentRegistrations.map((provider) => ({
            id: provider._id,
            name: provider.name,
            username: provider.username,
            email: provider.email,
            serviceCategory: provider.serviceCategory,
            status: provider.status,
            createdAt: provider.createdAt,
        }));

        return res.json(
            successHandler(200, {
                statistics: {
                    totalServiceProviders,
                    approvedServiceProviders,
                    pendingServiceProviders,
                    rejectedServiceProviders,
                    totalVehicles,
                    totalServiceBookings,
                    openServiceBookings,
                    totalServiceReviews,
                },
                recentRegistrations: formattedRecentRegistrations,
            }, "Statistics fetched successfully")
        );
    } catch (error) {
        console.error("Get service provider stats error:", error);
        return res.status(500).json(
            failureHandler(500, "Failed to fetch statistics")
        );
    }
});

module.exports = serviceProviders;
